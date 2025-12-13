import { CandlePoint, MarketType } from "./types";

const primary: Record<MarketType, string> = {
  spot: "https://api.binance.com",
  futures: "https://fapi.binance.com",
};

// data-api CDN은 지역 제한(451) 우회를 위한 백업 엔드포인트
const fallback: Record<MarketType, string> = {
  spot: "https://data-api.binance.vision",
  futures: "https://data-api.binance.vision", // fapi 경로 동일
};

async function fetchWithFallback(path: string, marketType: MarketType) {
  const first = `${primary[marketType]}${path}`;
  let res = await fetch(first, { cache: "no-store" });
  if (res.status === 451) {
    const second = `${fallback[marketType]}${path}`;
    res = await fetch(second, { cache: "no-store" });
  }
  return res;
}

export async function fetchTickerPrice(symbol: string, marketType: MarketType) {
  const path =
    marketType === "spot"
      ? `/api/v3/ticker/price?symbol=${encodeURIComponent(symbol)}`
      : `/fapi/v1/ticker/price?symbol=${encodeURIComponent(symbol)}`;

  const res = await fetchWithFallback(path, marketType);
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
  const path =
    marketType === "spot"
      ? `/api/v3/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`
      : `/fapi/v1/klines?symbol=${encodeURIComponent(symbol)}&interval=${interval}&limit=${limit}`;

  const res = await fetchWithFallback(path, marketType);
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
