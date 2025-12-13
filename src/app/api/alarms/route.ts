import { NextRequest, NextResponse } from "next/server";
import { alarmCreateSchema, alarmUpdateSchema } from "@/lib/validators";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/supabase";
import type { Alarm } from "@/lib/types";

type AlarmRow = Database["public"]["Tables"]["alarms"]["Row"];
type AlarmInsert = Database["public"]["Tables"]["alarms"]["Insert"];
type AlarmUpdate = Database["public"]["Tables"]["alarms"]["Update"];

const mapRowToAlarm = (row: AlarmRow): Alarm => ({
  id: row.id,
  symbol: row.symbol,
  // DB 타입이 string이라서 Alarm 타입에 맞게 여기서만 좁혀줌
  marketType: row.market_type as Alarm["marketType"],
  direction: row.direction as Alarm["direction"],
  targetPrice: Number(row.target_price),
  repeat: Boolean(row.repeat),
  note: row.note ?? undefined,
  active: Boolean(row.active),
  createdAt: row.created_at ?? "",
  firedAt: row.fired_at ?? undefined,
  lastPrice: row.last_price ?? undefined,
});

async function getUserId() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();
  return session?.user?.id;
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { data, error } = await supabase
    .from("alarms")
    .select("*")
    .eq("user_id", userId) // ✅ 본인 것만
    .order("created_at", { ascending: false });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ alarms: (data ?? []).map(mapRowToAlarm) });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = alarmCreateSchema.parse(body);

    const payload: AlarmInsert = {
      user_id: userId,
      symbol: parsed.symbol,
      market_type: parsed.marketType,  // ✅ validators가 enum이라 값은 정상
      direction: parsed.direction,
      target_price: parsed.targetPrice,
      repeat: parsed.repeat ?? false,
      note: parsed.note || null,
      active: true,
    };

    const { data, error } = await supabase
      .from("alarms")
      .insert(payload)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ alarm: mapRowToAlarm(data as AlarmRow) }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알람 생성 오류";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function PATCH(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = alarmUpdateSchema.parse(body);

    const updates: AlarmUpdate = {
      active: parsed.active,
      repeat: parsed.repeat,
    };

    const { data, error } = await supabase
      .from("alarms")
      .update(updates)
      .eq("id", parsed.id)
      .eq("user_id", userId)
      .select("*")
      .single();

    if (error) throw error;

    return NextResponse.json({ alarm: mapRowToAlarm(data as AlarmRow) });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알람 업데이트 오류";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  try {
    const body = await request.json();
    if (!body?.id) {
      return NextResponse.json({ error: "id가 필요합니다" }, { status: 400 });
    }

    const { error } = await supabase
      .from("alarms")
      .delete()
      .eq("id", body.id)
      .eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알람 삭제 오류";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
