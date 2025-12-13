import { NextRequest, NextResponse } from "next/server";
import { fetchTickerPrice } from "@/lib/binance";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram";
import type { Database } from "@/lib/types/supabase";

export const runtime = "edge";
export const preferredRegion = ["icn1"];

const DEMO_CHAT_ID = process.env.TELEGRAM_DEMO_CHAT_ID;

type AlarmRow = Database["public"]["Tables"]["alarms"]["Row"];
type AlarmUpdate = Database["public"]["Tables"]["alarms"]["Update"];
type TelegramLinkRow = Database["public"]["Tables"]["telegram_links"]["Row"];

function isTriggered(alarm: AlarmRow, price: number) {
  return alarm.direction === "above" ? price >= alarm.target_price : price <= alarm.target_price;
}

function requireEnv(name: string) {
  const v = process.env[name];
  if (!v) throw new Error(`Missing env: ${name}`);
  return v;
}

export async function POST(req: NextRequest) {
  try {
    // ✅ 시크릿 체크
    const url = new URL(req.url);
    const secret = url.searchParams.get("secret") || req.headers.get("x-cron-secret");

    if (process.env.CRON_SECRET) {
      if (!secret || secret !== process.env.CRON_SECRET) {
        return NextResponse.json({ error: "unauthorized" }, { status: 401 });
      }
    }

    // ✅ 크론 실행에 필요한 env 존재 확인 (여기서 빠지면 바로 원인 뜸)
    requireEnv("SUPABASE_URL");
    requireEnv("SUPABASE_SERVICE_ROLE_KEY");
    requireEnv("TELEGRAM_BOT_TOKEN"); // sendTelegramMessage에서 쓰는 경우

    const supabase = createSupabaseAdmin();

    const [{ data: active, error }, { data: links }] = await Promise.all([
      supabase.from("alarms").select("*").eq("active", true),
      supabase.from("telegram_links").select("user_id, chat_id, verified"),
    ]);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    if (!active || !active.length) return NextResponse.json({ checked: 0, fired: [], prices: {} });

    const activeAlarms = active as AlarmRow[];
    const linkRows = (links ?? []) as Pick<TelegramLinkRow, "user_id" | "chat_id" | "verified">[];

    const chatMap = linkRows.reduce<Record<string, string>>((acc, link) => {
      if (link.verified !== false && link.chat_id) acc[link.user_id] = link.chat_id;
      return acc;
    }, {});

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

    const fired: AlarmRow[] = [];

    for (const alarm of activeAlarms) {
      const key = `${alarm.symbol}:${alarm.market_type}`;
      const price = prices[key];
      if (price === undefined) continue;

      if (alarm.direction === "cross" && alarm.last_price === null) {
        await supabase.from("alarms").update({ last_price: price }).eq("id", alarm.id);
        continue;
      }

      const triggered =
        alarm.direction === "cross"
          ? isTriggered(alarm, price)
          : alarm.direction === "above"
            ? alarm.last_price !== null
              ? alarm.last_price < alarm.target_price && price >= alarm.target_price
              : price >= alarm.target_price
            : alarm.last_price !== null
              ? alarm.last_price > alarm.target_price && price <= alarm.target_price
              : price <= alarm.target_price;

      if (triggered) {
        const updates: AlarmUpdate = {
          fired_at: new Date().toISOString(),
          last_price: price,
          active: alarm.repeat ? true : false,
        };

        await supabase.from("alarms").update(updates).eq("id", alarm.id);
        fired.push(alarm);

        const chatId = chatMap[alarm.user_id] || DEMO_CHAT_ID;
        if (chatId) {
          const text = `[코인 알람] ${alarm.symbol} (${alarm.market_type})가 ${alarm.target_price} ${
            alarm.direction === "above" ? "이상" : "이하"
          } 돌파 (현재 ${price})${alarm.note ? `\n메모: ${alarm.note}` : ""}`;

          await sendTelegramMessage(chatId, text);
        }
      }

      if (alarm.direction === "cross" || alarm.repeat) {
        await supabase.from("alarms").update({ last_price: price }).eq("id", alarm.id);
      }
    }

    return NextResponse.json({ checked: activeAlarms.length, fired, prices });
  } catch (e) {
    console.error("check-alarms failed:", e);
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
