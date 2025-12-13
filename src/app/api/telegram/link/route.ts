import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const chatIdSchema = z.object({
  chatId: z.string().min(1, "chatId는 필수입니다"),
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
    .from("telegram_links")
    .select("chat_id, verified")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ chatId: data?.chat_id || null, verified: data?.verified ?? false });
}

export async function POST(request: NextRequest) {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  try {
    const body = await request.json();
    const parsed = chatIdSchema.parse(body);
    const { error } = await supabase
      .from("telegram_links")
      .upsert({
        user_id: userId,
        chat_id: parsed.chatId,
        verified: true,
      })
      .eq("user_id", userId);
    if (error) throw error;
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "chat_id 저장 오류";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE() {
  const supabase = await createSupabaseServerClient();
  const userId = await getUserId();
  if (!userId) return NextResponse.json({ error: "인증 필요" }, { status: 401 });

  const { error } = await supabase.from("telegram_links").delete().eq("user_id", userId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
