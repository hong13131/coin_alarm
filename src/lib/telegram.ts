const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET;

export function isTelegramConfigured() {
  return Boolean(TELEGRAM_TOKEN);
}

export function verifyTelegramSecret(headerToken?: string | null) {
  if (!TELEGRAM_SECRET) return true;
  return TELEGRAM_SECRET === headerToken;
}

export async function sendTelegramMessage(chatId: string, text: string) {
  if (!TELEGRAM_TOKEN) {
    console.warn("TELEGRAM_BOT_TOKEN is not set. Skipping message send.");
    return { ok: false };
  }
  const url = `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text }),
  });
  if (!res.ok) {
    console.error("Telegram send failed", await res.text());
  }
  return res.json();
}
