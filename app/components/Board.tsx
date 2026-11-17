"use client";

import Link from "next/link";
import { SYMBOLS, feedEffectiveLtvBps, feedStatus, relTime } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { BoardNotice, useBoard } from "./BoardProvider";
import { ASSET_NAMES, Gauge, StatusCell } from "./Instruments";
import { LadderChart } from "./LadderChart";

/** The single live reading under the hero actions. */
export function HeroReading() {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok?.feeds.SOL ?? null;
  if (!ok || !f) {
    return (
      <p className="reading">
        <span className="dot none" aria-hidden />
        <span>{state === null ? "Reading devnet" : "SOL feed not available"}</span>
      </p>
    );
  }
  const status = feedStatus(f, ok.config.params, now);
  return (
    <p className="reading" aria-live="off">
      <span className={`dot ${status}`} role="img" aria-label={status === "live" ? "Live" : "Stale"} />
      <span>
        SOL limit <strong>{pct1(feedEffectiveLtvBps(f, ok.config.params, now))}</strong>
      </span>
      <span className="sep">·</span>
      <span>implied vol {pct1(Number(f.sigmaBps))}</span>
      <span className="sep">·</span>
      <span>updated {relTime(now - Number(f.postedAt))}</span>
    </p>
  );
}

export function HeroChart() {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok?.feeds.SOL ?? null;
  return (
    <LadderChart
      symbol="SOL"
      feed={f}
      params={ok?.config.params ?? null}
      now={now}
      effectiveBps={ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null}
    />
  );
}

export function AssetList() {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const cap = ok?.config.params.govMaxLtvBps ?? 7500;
  const liq = ok?.config.params.liqThresholdBps ?? 8000;

  return (
    <>
      <BoardNotice state={state} />
      <div className="alist" role="table" aria-label="Borrowing limit per asset">
        <div className="arow alist-head" role="row">
          <span role="columnheader">Asset</span>
          <span role="columnheader" className="r col-vol">
            Implied vol
          </span>
          <span role="columnheader" className="gauge-head" aria-label={`Limit on a 0 to 100% scale, cap ${cap / 100}%`}>
            <span style={{ left: `${cap / 100}%` }}>{cap / 100}% cap</span>
          </span>
          <span role="columnheader" className="r">
            Limit
          </span>
          <span role="columnheader" className="status-text">
            Status
          </span>
        </div>
        {SYMBOLS.map((s) => {
          const f = ok ? ok.feeds[s] : null;
          const status = ok ? feedStatus(f, ok.config.params, now) : null;
          const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
          const vol = f ? pct1(Number(f.sigmaBps)) : "--";
          return (
            <Link key={s} href={`/asset/${s}`} className="arow" role="row">
              <span role="cell">
                <span className="asset-name">
                  <span className="sym">{s}</span>
                  <span className="name">{ASSET_NAMES[s]}</span>
                </span>
                <span className="asset-sub mono">
                  {ASSET_NAMES[s]} · vol {vol}
                </span>
              </span>
              <span role="cell" className="r mono col-vol">
                {vol}
              </span>
              <span role="cell">
                <Gauge limitBps={limit} capBps={cap} liqBps={liq} />
              </span>
              <span role="cell" className="r mono limit-val">
                {limit === null ? "--" : pct1(limit)}
              </span>
              <span role="cell">
                <StatusCell status={status} compact />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
