/** Assets the relayer posts. Silver is in the spec but is not in Gemini's crypto category; skipped when no ladder exists. */
export type Asset = {
  symbol: string;
  /** Tickers for "price X or above" ladders start with this, e.g. SOL2… . 5m/15m markets are SOL05M / SOL15M and are ignored. */
  tickerPrefix: string;
  pubticker: string;
};

export const ASSETS: readonly Asset[] = [
  { symbol: "SOL", tickerPrefix: "SOL2", pubticker: "solusd" },
  { symbol: "BTC", tickerPrefix: "BTC2", pubticker: "btcusd" },
  { symbol: "ETH", tickerPrefix: "ETH2", pubticker: "ethusd" },
  { symbol: "XRP", tickerPrefix: "XRP2", pubticker: "xrpusd" },
  { symbol: "ZEC", tickerPrefix: "ZEC2", pubticker: "zecusd" },
] as const;

export const MIN_EXPIRY_SECS = 900;
export const MAX_EXPIRY_SECS = 259_200;
export const MAX_SPREAD_BPS = 1500;
export const MIN_MID_BPS = 300;
export const MAX_MID_BPS = 9700;
export const MIN_TIGHT_QUOTES = 4;
export const MAX_QUOTES = 16;
export const CU_LIMIT = 120_000;
/** Tiny priority fee, micro-lamports per CU. */
export const PRIORITY_MICRO_LAMPORTS = 1_000;
