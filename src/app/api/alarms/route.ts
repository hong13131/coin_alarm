import { NextRequest, NextResponse } from "next/server";
import { alarmCreateSchema, alarmUpdateSchema } from "@/lib/validators";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/types/supabase";
import type { Alarm } from "@/lib/types";
import { z } from "zod";

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

    // (repeat 포함) "완전 동일(메모 포함)" 중복 생성 방지
    {
      const noteValue = (parsed.note ?? "").trim();

      let existingQuery = supabase
        .from("alarms")
        .select("id")
        .eq("user_id", userId)
        .eq("symbol", parsed.symbol)
        .eq("market_type", parsed.marketType)
        .eq("direction", parsed.direction)
        .eq("target_price", parsed.targetPrice)
        // active 컬럼이 nullable이라 과거 데이터(null)도 "활성"로 취급
        .neq("active", false)
        .limit(1);

      existingQuery =
        parsed.repeat === true
          ? existingQuery.eq("repeat", true)
          : existingQuery.or("repeat.is.null,repeat.eq.false");

      existingQuery = noteValue
        ? existingQuery.eq("note", noteValue)
        : existingQuery.or("note.is.null,note.eq.");

      const { data: existing, error: existingError } = await existingQuery;
      if (existingError) throw existingError;

      if (existing && existing.length > 0) {
        return NextResponse.json(
          { error: "이미 동일한 알람이 있습니다." },
          { status: 409 },
        );
      }
    }

    const payload: AlarmInsert = {
      user_id: userId,
      symbol: parsed.symbol,
      market_type: parsed.marketType,  // ✅ validators가 enum이라 값은 정상
      direction: parsed.direction,
      target_price: parsed.targetPrice,
      repeat: parsed.repeat ?? false,
      note: (parsed.note ?? "").trim() || null,
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

    const alarmUpdateManySchema = z.object({
      ids: z.array(z.string().min(1)).min(1),
      active: z.boolean().optional(),
      repeat: z.boolean().optional(),
    });

    const parsed = alarmUpdateSchema.or(alarmUpdateManySchema).parse(body);

    const updates: AlarmUpdate = {};
    if ("active" in parsed && parsed.active !== undefined) updates.active = parsed.active;
    if ("repeat" in parsed && parsed.repeat !== undefined) updates.repeat = parsed.repeat;

    const ids = "ids" in parsed ? parsed.ids : [parsed.id];

    if (ids.length === 1) {
      const { data, error } = await supabase
        .from("alarms")
        .update(updates)
        .eq("id", ids[0])
        .eq("user_id", userId)
        .select("*")
        .single();

      if (error) throw error;

      return NextResponse.json({ alarm: mapRowToAlarm(data as AlarmRow) });
    }

    const { data, error } = await supabase
      .from("alarms")
      .update(updates)
      .in("id", ids)
      .eq("user_id", userId)
      .select("*");

    if (error) throw error;

    return NextResponse.json({ alarms: (data ?? []).map((row) => mapRowToAlarm(row as AlarmRow)) });
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

    const alarmDeleteSchema = z
      .object({ id: z.string().min(1) })
      .or(z.object({ ids: z.array(z.string().min(1)).min(1) }));
    const parsed = alarmDeleteSchema.parse(body);
    const ids = "ids" in parsed ? parsed.ids : [parsed.id];

    const { error } = await supabase.from("alarms").delete().in("id", ids).eq("user_id", userId);

    if (error) throw error;

    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "알람 삭제 오류";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
