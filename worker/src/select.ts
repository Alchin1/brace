import {
  MAX_EXPIRY_SECS,
  MAX_MID_BPS,
  MAX_QUOTES,
  MAX_SPREAD_BPS,
  MIN_EXPIRY_SECS,
  MIN_MID_BPS,
  MIN_TIGHT_QUOTES,
  type Asset,
} from "./assets.ts";
import { decimalToScaled, type Quote } from "./encode.ts";
import { expiryUnix, type GeminiEvent } from "./gemini.ts";

export type SelectedLadder = {
  asset: string;
  ticker: string;
  expiryTs: number;
  quotes: Quote[];
  tightCount: number;
};

type RankedQuote = Quote & { mid: number };

function tightQuotes(ev: GeminiEvent): RankedQuote[] {
  const out: RankedQuote[] = [];
  for (const c of ev.contracts ?? []) {
    if ((c.strike?.type ?? "").toLowerCase() !== "above") continue;
    const bid = decimalToScaled(c.prices?.bestBid ?? null, 4);
    const ask = decimalToScaled(c.prices?.bestAsk ?? null, 4);
    const strike = decimalToScaled(c.strike?.value ?? null, 6);
    if (bid === null || ask === null || strike === null) continue;
    if (bid === 0n || ask === 0n || ask < bid) continue;
    if (ask - bid > BigInt(MAX_SPREAD_BPS)) continue;
    const mid = Number((bid + ask) / 2n);
    if (mid < MIN_MID_BPS || mid > MAX_MID_BPS) continue;
    out.push({ strikeE6: strike, bidBps: Number(bid), askBps: Number(ask), mid });
  }
  return out;
}

/**
 * Pick the earliest-expiring "price X or above" ladder for an asset with at least
 * MIN_TIGHT_QUOTES usable contracts in the 15m–72h window. Returns null if none.
 */
export function selectLadder(events: GeminiEvent[], asset: Asset, nowSeconds: number): SelectedLadder | null {
  const candidates: { ev: GeminiEvent; expiryTs: number; tight: RankedQuote[] }[] = [];
  for (const ev of events) {
    const ticker = ev.ticker ?? "";
    if (!ticker.startsWith(asset.tickerPrefix)) continue;
    const expiryTs = expiryUnix(ev);
    if (expiryTs === null) continue;
    const t = expiryTs - nowSeconds;
    if (t < MIN_EXPIRY_SECS || t > MAX_EXPIRY_SECS) continue;
    const tight = tightQuotes(ev);
    if (tight.length < MIN_TIGHT_QUOTES) continue;
    candidates.push({ ev, expiryTs, tight });
  }
  if (candidates.length === 0) return null;
  candidates.sort((a, b) => a.expiryTs - b.expiryTs);
  const best = candidates[0];
  const ranked = [...best.tight].sort((a, b) => Math.abs(a.mid - 5000) - Math.abs(b.mid - 5000));
  const quotes: Quote[] = ranked.slice(0, MAX_QUOTES).map(({ strikeE6, bidBps, askBps }) => ({
    strikeE6,
    bidBps,
    askBps,
  }));
  return {
    asset: asset.symbol,
    ticker: best.ev.ticker ?? "",
    expiryTs: best.expiryTs,
    quotes,
    tightCount: best.tight.length,
  };
}
