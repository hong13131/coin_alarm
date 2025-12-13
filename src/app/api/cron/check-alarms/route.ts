import { NextResponse } from "next/server";
import { fetchTickerPrice } from "@/lib/binance";
import { createSupabaseAdmin } from "@/lib/supabase/admin";
import { sendTelegramMessage } from "@/lib/telegram";
import type { Database } from "@/lib/types/supabase";

const DEMO_CHAT_ID = process.env.TELEGRAM_DEMO_CHAT_ID;

type AlarmRow = Database["public"]["Tables"]["alarms"]["Row"];
type AlarmUpdate = Database["public"]["Tables"]["alarms"]["Update"];
type TelegramLinkRow = Database["public"]["Tables"]["telegram_links"]["Row"];

function isTriggered(alarm: AlarmRow, price: number) {
  // 위/아래 단순 비교(기본)
  return alarm.direction === "above" ? price >= alarm.target_price : price <= alarm.target_price;
}

export async function POST() {
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
    // DB 타입은 string이라서 fetchTickerPrice가 유니온을 원하면 캐스팅
    prices[key] = await fetchTickerPrice(
      sample.symbol,
      sample.market_type as "spot" | "futures"
    );
  }

  const fired: AlarmRow[] = [];

  for (const alarm of activeAlarms) {
    const key = `${alarm.symbol}:${alarm.market_type}`;
    const price = prices[key];
    if (price === undefined) continue;

    // cross의 경우 이전 가격이 없으면 먼저 저장하고 패스
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

    // 가격 추적 업데이트 (repeat/cross 모두)
    if (alarm.direction === "cross" || alarm.repeat) {
      await supabase.from("alarms").update({ last_price: price }).eq("id", alarm.id);
    }
  }

  return NextResponse.json({ checked: activeAlarms.length, fired, prices });
}
