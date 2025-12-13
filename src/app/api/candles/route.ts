import { NextRequest, NextResponse } from "next/server";
import { fetchCandles } from "@/lib/binance";
import { candlesQuerySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const parsed = candlesQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const candles = await fetchCandles({
      symbol: parsed.symbol,
      interval: parsed.interval,
      limit: parsed.limit,
      marketType: parsed.type,
    });
    return NextResponse.json({ symbol: parsed.symbol, marketType: parsed.type, candles });
  } catch (error) {
    const message = error instanceof Error ? error.message : "캔들 조회 오류";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
