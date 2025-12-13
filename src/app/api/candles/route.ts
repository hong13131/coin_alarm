import { NextRequest, NextResponse } from "next/server";
import { fetchCandles } from "@/lib/binance";
import { candlesQuerySchema } from "@/lib/validators";

// ✅ Vercel에서 바이낸스 451 회피용: 한국(인천) Edge로 실행 유도
export const runtime = "edge";
export const preferredRegion = ["icn1"];

export async function GET(request: NextRequest) {
  const parsed = candlesQuerySchema.safeParse(
    Object.fromEntries(request.nextUrl.searchParams.entries()),
  );

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid query", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const candles = await fetchCandles({
      symbol: parsed.data.symbol,
      interval: parsed.data.interval,
      limit: parsed.data.limit,
      marketType: parsed.data.type,
    });

    return NextResponse.json({
      symbol: parsed.data.symbol,
      marketType: parsed.data.type,
      candles,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "캔들 조회 실패";
    // 바이낸스 응답 문제는 502로 구분 (query 문제 400이랑 분리)
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
