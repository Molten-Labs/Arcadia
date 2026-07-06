export interface PhoenixMarketStats {
  symbol: string;
  markPx: number;
  oraclePx: number;
  midPx: number;
  prevDayPx: number;
  dayNtlVlm: number;
  openInterest: number;
  funding: number;
}

export interface PhoenixOrderbookLevel {
  price: number;
  size: number;
}

export interface PhoenixOrderbook {
  symbol: string;
  bids: PhoenixOrderbookLevel[];
  asks: PhoenixOrderbookLevel[];
  mid: number;
}

export interface PhoenixTrade {
  tradeSequenceNumber: number;
  slot: number;
  timestamp: string;
  time: number;
  side: "b" | "s";
  price: number;
  size: number;
  notional: number;
  numFills: number;
}

export interface PhoenixTradesMessage {
  symbol: string;
  trades: PhoenixTrade[];
}

export interface PhoenixCandle {
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
  volumeQuote?: number;
  tradeCount?: number;
}

export interface PhoenixFundingRate {
  symbol: string;
  funding: number;
  fundingTime?: number;
}

export interface PhoenixExchangeState {
  active: boolean;
  gated: boolean;
}

export interface PhoenixMarketConfig {
  symbol: string;
  tickSize: number;
  takerFee: number;
  makerFee: number;
  leverageTiers: { maxLeverage: number; maxSizeBaseLots: number; limitOrderRiskFactor: number }[];
  minOrderSize?: number;
}

export interface PhoenixState {
  marketStats: Record<string, PhoenixMarketStats>;
  orderbook: Record<string, PhoenixOrderbook | null>;
  trades: Record<string, PhoenixTrade[]>;
  candles: Record<string, PhoenixCandle[]>;
  fundingRate: Record<string, PhoenixFundingRate>;
  exchange: PhoenixExchangeState | null;
  marketConfigs: Record<string, PhoenixMarketConfig>;
  connected: boolean;
  error: string | null;
}
