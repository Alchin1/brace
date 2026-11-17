"use client";

import Link from "next/link";
import {
  explorerAddress,
  feedEffectiveLtvBps,
  feedPda,
  feedStatus,
  fromE6,
  relTime,
  untilTime,
  type Symbol,
} from "@/lib/brace";
import { horizonLabel, pct1 } from "@/lib/chart";
import { BoardNotice, useBoard } from "./BoardProvider";
import { ASSET_NAMES, Gauge, StatusCell } from "./Instruments";
import { LadderChart, expiryLabel } from "./LadderChart";

export function AssetDetail({ symbol }: { symbol: Symbol }) {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok ? ok.feeds[symbol] : null;
  const p = ok?.config.params ?? null;
  const pda = feedPda(symbol).toBase58();
  const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
  const status = ok ? feedStatus(f, ok.config.params, now) : null;
  const cap = p?.govMaxLtvBps ?? 7500;
  const liq = p?.liqThresholdBps ?? 8000;

  const rows: [string, string][] =
    ok && f && p
      ? [
          ["Spot price", `$${fromE6(f.spotE6)}`],
          ["Implied median at expiry", `$${fromE6(f.medianE6)}`],
          ["Implied volatility (annual)", pct1(Number(f.sigmaBps))],
          [`${horizonLabel(p.horizonSecs)} move (1σ)`, `${(Number(f.horizonMoveE6) / 1e4).toFixed(2)}%`],
          ["Quotes used", `${f.points}`],
          ["Gemini market", f.ticker || "none"],
          ["Expires", `${expiryLabel(Number(f.expiryTs), now)}, ${untilTime(Number(f.expiryTs) - now)}`],
          ["Last confident update", f.hasValid ? relTime(now - Number(f.lastValidAt)) : "never"],
          ["Max limit", pct1(f.maxLtvBps)],
          ["Limit right now", limit === null ? "--" : pct1(limit)],
        ]
      : [];

  return (
    <div className="page">
      <Link href="/" className="crumb text-link">
        All assets
      </Link>
      <div className="asset-top">
        <div className="asset-title">
          <h1>{symbol}</h1>
          <span className="name">{ASSET_NAMES[symbol]}</span>
        </div>
        <StatusCell status={status} />
      </div>

      <div style={{ marginTop: 24 }}>
        <BoardNotice state={state} />
        {ok && !f && (
          <div className="notice" role="status">
            <strong>No data</strong>
            <span className="muted">The {symbol} feed account does not exist on devnet yet.</span>
          </div>
        )}
      </div>

      <div className="asset-grid">
        <LadderChart symbol={symbol} feed={f} params={p} now={now} effectiveBps={limit} />

        <div>
          <div className="card limit-panel">
            <div className="big">
              <span className="label">Limit right now</span>
              <span className="v">{limit === null ? "--" : pct1(limit)}</span>
            </div>
            <div className="gauge-wrap">
              <div className="gauge-head">
                <span className="muted" style={{ left: `${cap / 100}%` }}>
                  {cap / 100}% cap
                </span>
              </div>
              <Gauge limitBps={limit} capBps={cap} liqBps={liq} />
              <div className="gauge-head" style={{ height: 16 }}>
                <span className="muted" style={{ right: 0, top: 2, bottom: "auto", transform: "none" }}>
                  liquidation at {liq / 100}%
                </span>
                <span className="muted" style={{ left: 0, top: 2, bottom: "auto", transform: "none" }}>
                  0%
                </span>
              </div>
            </div>
          </div>

          {rows.length > 0 && (
            <dl className="facts">
              {rows.map(([k, v]) => (
                <div key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </div>
              ))}
            </dl>
          )}

          <p className="account-link">
            Feed account{" "}
            <a href={explorerAddress(pda)} target="_blank" rel="noopener noreferrer" className="text-link mono">
              {pda.slice(0, 4)}…{pda.slice(-4)}
            </a>{" "}
            on Solana Explorer
          </p>
        </div>
      </div>
    </div>
  );
}
