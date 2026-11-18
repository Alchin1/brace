"use client";

import { feedEffectiveLtvBps, feedStatus, relTime, type Feed, type FeedStatus, type Params, type Symbol } from "@/lib/brace";
import { bandRange, limitPath, sigmaT } from "@/lib/chart";
import { useBoard } from "../BoardProvider";

/** Everything a view needs about one feed, derived only from the devnet read. Nulls mean "not read". */
export type FeedModel = {
  symbol: Symbol;
  loading: boolean;
  down: boolean;
  feed: Feed | null;
  params: Params | null;
  now: number;
  limit: number | null;
  status: FeedStatus | null;
  cap: number;
  liq: number;
  spot: number | null;
  median: number | null;
  sT: number;
  move: number | null;
  band: { lo: number; hi: number; movePct: number } | null;
  k: number;
  path: ReturnType<typeof limitPath> | null;
  ageText: string | null;
};

export function useFeedModel(symbol: Symbol): FeedModel {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const feed = ok?.feeds[symbol] ?? null;
  const params = ok?.config.params ?? null;
  const limit = ok && feed ? feedEffectiveLtvBps(feed, ok.config.params, now) : null;
  const status = ok ? feedStatus(feed, ok.config.params, now) : null;
  const cap = params?.govMaxLtvBps ?? 7500;
  const liq = params?.liqThresholdBps ?? 8000;
  const k = params ? params.kX100 / 100 : 3;
  let spot: number | null = null;
  let median: number | null = null;
  let sT = 0;
  let move: number | null = null;
  let band: FeedModel["band"] = null;
  let path: FeedModel["path"] = null;
  if (feed && params) {
    spot = Number(feed.spotE6) / 1e6;
    median = Number(feed.medianE6) / 1e6;
    sT = feed.hasValid ? sigmaT(Number(feed.sigmaBps), Number(feed.expiryTs) - Number(feed.lastValidAt)) : 0;
    move = Number(feed.horizonMoveE6) / 1e6;
    band = move > 0 && spot > 0 ? bandRange(spot, move, k) : null;
    if (feed.hasValid && limit !== null) {
      path = limitPath({
        horizonMoveE6: Number(feed.horizonMoveE6),
        kX100: params.kX100,
        liqBps: params.liqThresholdBps,
        floorBps: params.absFloorLtvBps,
        capBps: params.govMaxLtvBps,
        horizonSecs: params.horizonSecs,
        maxLtvBps: feed.maxLtvBps,
        effectiveBps: limit,
      });
    }
  }
  const ageText = feed && now > 0 ? (feed.hasValid ? relTime(now - Number(feed.lastValidAt)) : "never") : null;
  return { symbol, loading: state === null, down: state?.kind === "error", feed, params, now, limit, status, cap, liq, spot, median, sT, move, band, k, path, ageText };
}

/** "69.1" without the percent sign, for the monumental figure. */
export function figure(bps: number): string {
  return (Math.round(bps / 10) / 10).toFixed(1);
}
