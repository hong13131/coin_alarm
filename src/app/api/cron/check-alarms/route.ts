import { NextRequest, NextResponse } from "next/server";
import { fetchTickerPrice } from "@/lib/binance";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram";
import type { Database } from "@/lib/types/supabase";

// ✅ 바이낸스 451 회피(한국 Edge로 유도)
export const runtime = "edge";
export const preferredRegion = ["icn1"];

const DEMO_CHAT_ID = process.env.TELEGRAM_DEMO_CHAT_ID;

type AlarmRow = Database["public"]["Tables"]["alarms"]["Row"];
type AlarmUpdate = Database["public"]["Tables"]["alarms"]["Update"];
type TelegramLinkRow = Database["public"]["Tables"]["telegram_links"]["Row"];

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

/**
 * 트리거 규칙(관통 기준):
 * - above(상승 돌파): prev < target && curr >= target
 * - below(하락 돌파): prev > target && curr <= target
 * - cross(양방향 돌파): 위 둘 중 하나라도 만족
 *
 * last_price가 null이면:
 * - above/below/cross 모두 첫 체크에서는 발동하지 않고 last_price만 저장 (이후 "진짜 돌파"만 감지)
 */
function computeTriggered(alarm: AlarmRow, prev: number | null, curr: number): boolean {
  const target = alarm.target_price;

  const crossUp = prev !== null && prev < target && curr >= target;
  const crossDown = prev !== null && prev > target && curr <= target;

  if (alarm.direction === "above") {
    return crossUp;
  }
  if (alarm.direction === "below") {
    return crossDown;
  }
  // cross
  if (prev === null) return false; // 첫 체크는 last_price만 저장
  return crossUp || crossDown;
}

export async function POST(req: NextRequest) {
  try {
    // ✅ 크론 보호(쿼리 or 헤더 둘 다 허용)
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") || req.headers.get("x-cron-secret");
    if (process.env.CRON_SECRET) {
      if (!secret || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }

    // ✅ 필요한 env 체크(없으면 원인 바로 보이게)
    requireEnv("SUPABASE_URL");
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    // 텔레그램은 “발송할 상황”에서만 필요하지만, 운영에선 있는 게 정상이라 체크
    requireEnv("TELEGRAM_BOT_TOKEN");

    const supabase = createSupabaseAdmin();

    const [{ data: active, error: alarmsError }, { data: links, error: linksError }] =
      await Promise.all([
        supabase.from("alarms").select("*").eq("active", true),
        supabase.from("telegram_links").select("user_id, chat_id, verified"),
      ]);

    if (alarmsError) return NextResponse.json({ error: alarmsError.message }, { status: 500 });
    if (linksError) return NextResponse.json({ error: linksError.message }, { status: 500 });
    if (!active || active.length === 0) {
      return NextResponse.json({ checked: 0, fired: [], prices: {} });
    }

    const activeAlarms = active as AlarmRow[];
    const linkRows = (links ?? []) as Pick<TelegramLinkRow, "user_id" | "chat_id" | "verified">[];

    // user_id -> chat_id
    const chatMap = linkRows.reduce<Record<string, string>>((acc, link) => {
      if (link.verified !== false && link.chat_id) acc[link.user_id] = link.chat_id;
      return acc;
    }, {});

    // (symbol, market_type)별로 가격을 1번만 조회
    const grouped = activeAlarms.reduce<Record<string, AlarmRow[]>>((acc, alarm) => {
      const key = `${alarm.symbol}:${alarm.market_type}`;
      (acc[key] ??= []).push(alarm);
      return acc;
    }, {});

    const prices: Record<string, number> = {};
    for (const key of Object.keys(grouped)) {
      const sample = grouped[key][0];
      prices[key] = await fetchTickerPrice(sample.symbol, sample.market_type as "spot" | "futures");
    }

    const fired: Array<{
      id: string;
      symbol: string;
      market_type: string;
      direction: string;
      target_price: number;
      price: number;
      user_id: string;
      sent: boolean;
      reason?: string;
    }> = [];

    // 알람 처리
    for (const alarm of activeAlarms) {
      const key = `${alarm.symbol}:${alarm.market_type}`;
      const curr = prices[key];
      if (curr === undefined) continue;

      const prev = alarm.last_price;
      const triggered = computeTriggered(alarm, prev, curr);

      // 업데이트는 한 번만 모아서 하자
      const updates: AlarmUpdate = {
        last_price: curr, // ✅ 매 체크마다 최신가 저장 (cross/above/below 모두 다음 관통 계산에 필요)
      };

      if (triggered) {
        updates.fired_at = new Date().toISOString();
        // repeat=false면 끄기
        if (!alarm.repeat) updates.active = false;

        // DB 업데이트 먼저
        const { error: upErr } = await supabase.from("alarms").update(updates).eq("id", alarm.id);
        if (upErr) {
          fired.push({
            id: alarm.id,
            symbol: alarm.symbol,
            market_type: alarm.market_type,
            direction: alarm.direction,
            target_price: alarm.target_price,
            price: curr,
            user_id: alarm.user_id,
            sent: false,
            reason: `db_update_failed: ${upErr.message}`,
          });
          continue;
        }

        // 텔레그램 전송 (실패해도 전체 작업은 계속)
        const chatId = chatMap[alarm.user_id] || DEMO_CHAT_ID;
        if (!chatId) {
          fired.push({
            id: alarm.id,
            symbol: alarm.symbol,
            market_type: alarm.market_type,
            direction: alarm.direction,
            target_price: alarm.target_price,
            price: curr,
            user_id: alarm.user_id,
            sent: false,
            reason: "no_chat_id",
          });
          continue;
        }

        const dirText =
          alarm.direction === "above"
            ? "상승 돌파"
            : alarm.direction === "below"
              ? "하락 돌파"
              : "양방향 돌파";

        const text =
          `[코인 알람] ${dirText}\n` +
          `- ${alarm.symbol} (${alarm.market_type})\n` +
          `- 기준가: ${alarm.target_price}\n` +
          `- 현재가: ${curr}\n` +
          (alarm.note ? `\n메모: ${alarm.note}` : "");

        try {
          await sendTelegramMessage(chatId, text);
          fired.push({
            id: alarm.id,
            symbol: alarm.symbol,
            market_type: alarm.market_type,
            direction: alarm.direction,
            target_price: alarm.target_price,
            price: curr,
            user_id: alarm.user_id,
            sent: true,
          });
        } catch (e) {
          console.error("telegram send failed:", e);
          fired.push({
            id: alarm.id,
            symbol: alarm.symbol,
            market_type: alarm.market_type,
            direction: alarm.direction,
            target_price: alarm.target_price,
            price: curr,
            user_id: alarm.user_id,
            sent: false,
            reason: e instanceof Error ? e.message : String(e),
          });
        }
      } else {
        // 트리거가 아니어도 last_price는 업데이트해야 다음에 관통 계산 가능
        // 단, prev가 null이고 cross면 computeTriggered가 false로 떨어지므로 여기서 last_price만 저장됨
        const { error: upErr } = await supabase.from("alarms").update(updates).eq("id", alarm.id);
        if (upErr) console.error("update last_price failed:", upErr.message);
      }
    }

    return NextResponse.json({
      checked: activeAlarms.length,
      fired,
      prices,
    });
  } catch (e) {
    console.error("check-alarms failed:", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
