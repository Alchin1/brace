import { decimalToScaled } from "./encode.ts";
import type { Asset } from "./assets.ts";

export type GeminiContract = {
  ticker?: string;
  label?: string;
  strike?: { type?: string; value?: string };
  prices?: { bestBid?: string | null; bestAsk?: string | null };
};

export type GeminiEvent = {
  ticker?: string;
  title?: string;
  type?: string;
  expiryDate?: string;
  contracts?: GeminiContract[];
};

export type GeminiEventsResponse = {
  data?: GeminiEvent[];
};

export const EVENTS_URL =
  "https://api.gemini.com/v1/prediction-markets/events?status=active&limit=200&category=crypto";

export function pubtickerUrl(pubticker: string): string {
  return `https://api.gemini.com/v1/pubticker/${pubticker}`;
}

export function expiryUnix(ev: GeminiEvent): number | null {
  if (!ev.expiryDate) return null;
  const ms = Date.parse(ev.expiryDate);
  if (!Number.isFinite(ms)) return null;
  return Math.floor(ms / 1000);
}

export async function fetchEvents(fetchFn: typeof fetch = fetch): Promise<GeminiEvent[]> {
  const res = await fetchFn(EVENTS_URL);
  if (!res.ok) throw new Error(`Gemini events HTTP ${res.status}`);
  const json = (await res.json()) as GeminiEventsResponse | GeminiEvent[];
  const data = Array.isArray(json) ? json : json.data;
  if (!Array.isArray(data)) throw new Error("unexpected Gemini events shape");
  return data;
}

export async function fetchSpotE6(asset: Asset, fetchFn: typeof fetch = fetch): Promise<bigint> {
  const res = await fetchFn(pubtickerUrl(asset.pubticker));
  if (!res.ok) throw new Error(`Gemini pubticker ${asset.pubticker} HTTP ${res.status}`);
  const json = (await res.json()) as { last?: string };
  const spot = decimalToScaled(json.last, 6);
  if (spot === null || spot <= 0n) throw new Error(`bad pubticker last for ${asset.symbol}: ${json.last}`);
  return spot;
}
