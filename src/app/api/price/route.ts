import { NextRequest, NextResponse } from "next/server";
import { fetchTickerPrice } from "@/lib/binance";
import { priceQuerySchema } from "@/lib/validators";

export async function GET(request: NextRequest) {
  try {
    const parsed = priceQuerySchema.parse(
      Object.fromEntries(request.nextUrl.searchParams.entries()),
    );
    const price = await fetchTickerPrice(parsed.symbol, parsed.type);
    return NextResponse.json({ symbol: parsed.symbol, marketType: parsed.type, price });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격 조회 오류";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
