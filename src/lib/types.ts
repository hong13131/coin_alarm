export type MarketType = "spot" | "futures";

export type CandlePoint = {
  time: number; // seconds since epoch
  open: number;
  high: number;
  low: number;
  close: number;
};

export type AlarmDirection = "above" | "below" | "cross";

export type AlarmPayload = {
  symbol: string;
  marketType: MarketType;
  direction: AlarmDirection;
  targetPrice: number;
  repeat?: boolean;
  note?: string;
};

export type Alarm = AlarmPayload & {
  id: string;
  active: boolean;
  createdAt: string;
  firedAt?: string | null;
  lastPrice?: number | null;
};
