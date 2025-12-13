import { NextRequest, NextResponse } from "next/server";
import { marketTypeSchema } from "@/lib/validators";

type BinanceSymbol = {
  symbol: string;
  status: string;
  baseAsset?: string;
  quoteAsset?: string;
};

const endpoints = {
  spot: "https://api.binance.com/api/v3/exchangeInfo",
  futures: "https://fapi.binance.com/fapi/v1/exchangeInfo",
} as const;

export async function GET(request: NextRequest) {
  const params = Object.fromEntries(request.nextUrl.searchParams.entries());
  const marketType = marketTypeSchema.catch("spot").parse(params.type);
  const query = (params.q || "").toUpperCase();

  try {
    const res = await fetch(endpoints[marketType], { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json({ error: "심볼 정보를 불러올 수 없습니다" }, { status: 502 });
    }
    const data = (await res.json()) as { symbols?: BinanceSymbol[] };
    const symbols = (data.symbols || [])
      .filter((s) => s.status === "TRADING")
      .map((s) => ({
        symbol: s.symbol,
        base: s.baseAsset,
        quote: s.quoteAsset,
      }))
      .filter((s) => (query ? s.symbol.includes(query) || s.base?.includes(query) : true))
      .slice(0, 20);

    return NextResponse.json({ symbols, marketType });
  } catch (error) {
    const message = error instanceof Error ? error.message : "심볼 검색 오류";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
