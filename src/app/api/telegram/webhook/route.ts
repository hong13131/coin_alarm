import { NextRequest, NextResponse } from "next/server";
import { sendTelegramMessage, verifyTelegramSecret, isTelegramConfigured } from "@/lib/telegram";

type TelegramUpdate = {
  message?: {
    chat: { id: number; username?: string };
    text?: string;
  };
};

export async function POST(request: NextRequest) {
  if (!isTelegramConfigured()) {
    return NextResponse.json({ error: "Telegram not configured" }, { status: 501 });
  }

  const secretHeader = request.headers.get("x-telegram-bot-api-secret-token");
  if (!verifyTelegramSecret(secretHeader)) {
    return NextResponse.json({ error: "invalid secret" }, { status: 401 });
  }

  const update = (await request.json()) as TelegramUpdate;
  const message = update.message;
  if (!message?.chat?.id) {
    return NextResponse.json({ ok: true });
  }

  const chatId = message.chat.id.toString();
  const text = message.text || "";

  if (text.startsWith("/start")) {
    await sendTelegramMessage(
      chatId,
      `코인 알람 봇과 연결되었습니다.\n아래 chat_id를 앱에 붙여넣으세요:\n${chatId}`,
    );
  } else {
    await sendTelegramMessage(chatId, "알람 설정은 웹에서 진행해주세요.");
  }

  return NextResponse.json({ ok: true });
}
