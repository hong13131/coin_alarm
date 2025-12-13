import { NextRequest, NextResponse } from "next/server";
import { fetchTickerPrice } from "@/lib/binance";
import { priceQuerySchema } from "@/lib/validators";

// ✅ Vercel에서 바이낸스 451 회피용: 한국(인천) Edge로 실행 유도
export const runtime = "edge";
export const preferredRegion = ["icn1"];

export async function GET(request: NextRequest) {
  // query는 safeParse로 처리해서 400 원인 구분되게
  const parsed = priceQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const price = await fetchTickerPrice(parsed.data.symbol, parsed.data.type);
    return NextResponse.json({
      symbol: parsed.data.symbol,
      marketType: parsed.data.type,
      price,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "가격 조회 실패";
    // 바이낸스에서 451을 던지면 서버 쪽 문제니까 502로 구분
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
