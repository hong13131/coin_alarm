import { CandlePoint, MarketType } from "./types";

const endpoints: Record<MarketType, string> = {
  spot: "https://api.binance.com",
  futures: "https://fapi.binance.com",
};

export async function fetchTickerPrice(symbol: string, marketType: MarketType) {
  const base = endpoints[marketType];
  const path = marketType === "spot" ? "/api/v3/ticker/price" : "/fapi/v1/ticker/price";
  const url = `${base}${path}?symbol=${encodeURIComponent(symbol)}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`가격 조회 실패 (${res.status})`);
  }
  const data = (await res.json()) as { price: string };
  return Number(data.price);
}

export async function fetchCandles(params: {
  symbol: string;
  marketType: MarketType;
  interval: string;
  limit: number;
}): Promise<CandlePoint[]> {
  const { symbol, marketType, interval, limit } = params;
  const base = endpoints[marketType];
  const path = marketType === "spot" ? "/api/v3/klines" : "/fapi/v1/klines";
  const url = `${base}${path}?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;

  const res = await fetch(url, { next: { revalidate: 0 } });
  if (!res.ok) {
    throw new Error(`캔들 조회 실패 (${res.status})`);
  }

  const raw = (await res.json()) as [number, string, string, string, string][];
  return raw.map((candle) => ({
    time: Math.floor(candle[0] / 1000),
    open: Number(candle[1]),
    high: Number(candle[2]),
    low: Number(candle[3]),
    close: Number(candle[4]),
  }));
}
