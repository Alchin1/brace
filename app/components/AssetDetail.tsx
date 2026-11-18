"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight } from "lucide-react";
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
import { ASSET_NAMES, StatusCell } from "./Instruments";
import { LadderChart, expiryLabel } from "./LadderChart";
import { AssetGlyph } from "./ui/AssetGlyph";
import { CopyField } from "./ui/CopyField";
import { BlockMeter, LimitRing } from "./ui/Meters";
import { RollingNumber } from "./ui/RollingNumber";
import { SparkProvider, Sparkline, useSpark } from "./ui/Sparks";

const WINDOW = 6 * 3600;

/** Change of the limit over the sparkline window, from real rows only. */
function SparkDelta({ symbol }: { symbol: Symbol }) {
  const { series } = useSpark(symbol);
  if (!series || series.length < 2) return <span className="delta">--</span>;
  const d = (series[series.length - 1].v - series[0].v) * 100;
  const s = `${d > 0 ? "+" : d < 0 ? "−" : ""}${Math.abs(d).toFixed(1)} pts`;
  return <span className={`delta ${d > 0 ? "up" : d < 0 ? "down" : ""}`}>{s}</span>;
}

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

  const groups: { h: string; rows: [string, string][] }[] =
    ok && f && p
      ? [
          {
            h: "Market",
            rows: [
              ["Spot price", `$${fromE6(f.spotE6)}`],
              ["Implied median at expiry", `$${fromE6(f.medianE6)}`],
              ["Gemini market", f.ticker || "none"],
              ["Expires", `${expiryLabel(Number(f.expiryTs), now)}, ${untilTime(Number(f.expiryTs) - now)}`],
            ],
          },
          {
            h: "Oracle",
            rows: [
              ["Implied volatility (annual)", pct1(Number(f.sigmaBps))],
              [`${horizonLabel(p.horizonSecs)} move (1σ)`, `${(Number(f.horizonMoveE6) / 1e4).toFixed(2)}%`],
              ["Quotes used", `${f.points}`],
              ["Last confident update", f.hasValid ? relTime(now - Number(f.lastValidAt)) : "never"],
            ],
          },
          {
            h: "Limits",
            rows: [
              ["Max limit (last confident)", pct1(f.maxLtvBps)],
              ["Governance cap", pct1(cap)],
              ["Liquidation threshold", pct1(liq)],
            ],
          },
        ]
      : [];

  return (
    <div className="page asset-page">
      <Link href="/" className="crumb">
        <ArrowLeft size={16} aria-hidden /> All assets
      </Link>
      <div className="asset-top">
        <div className="asset-title">
          <AssetGlyph sym={symbol} size={52} />
          <div>
            <h1>{symbol}</h1>
            <span className="name">{ASSET_NAMES[symbol]} feed on Solana devnet</span>
          </div>
        </div>
        <span className="status-pill">
          <StatusCell status={status} />
        </span>
      </div>

      <div className="asset-notices">
        <BoardNotice state={state} />
        {ok && !f && (
          <div className="notice" role="status">
            <strong>No data</strong>
            <span className="muted">The {symbol} feed account does not exist on devnet yet.</span>
          </div>
        )}
      </div>

      <SparkProvider symbols={[symbol]} windowSecs={WINDOW} className="asset-grid">
        <LadderChart symbol={symbol} feed={f} params={p} now={now} effectiveBps={limit} />

        <aside className="asset-side">
          <div className="limit-card card-lit">
            <LimitRing
              limitBps={limit}
              capBps={cap}
              liqBps={liq}
              size={200}
              tone={status === "stale" ? "stale" : undefined}
              center={<span className="ring-v big">{limit === null ? "--" : <RollingNumber value={pct1(limit)} />}</span>}
              sub="Limit right now"
            />
            <div className="limit-side">
              <div className="ls-row">
                <span>Implied vol</span>
                <strong>{f ? pct1(Number(f.sigmaBps)) : "--"}</strong>
              </div>
              <BlockMeter valueBps={f ? Math.min(10000, (Number(f.sigmaBps) / 15000) * 10000) : null} capBps={null} label="Implied volatility on a 0 to 150% scale" />
              <div className="ls-row">
                <span>Limit, last 6 hours</span>
                <SparkDelta symbol={symbol} />
              </div>
              <Sparkline sym={symbol} width={240} height={52} className="ls-spark" />
            </div>
            {symbol === "SOL" ? (
              <Link href="/borrow" className="btn btn-primary btn-block">
                Try a borrow against SOL <ArrowRight size={16} aria-hidden />
              </Link>
            ) : (
              <p className="ls-note">
                The demo pool takes SOL as collateral.{" "}
                <Link href="/asset/SOL" className="text-link">
                  Open the SOL feed
                </Link>
              </p>
            )}
          </div>
        </aside>
      </SparkProvider>

      {groups.length > 0 && (
        <div className="fact-groups" data-reveal>
          {groups.map((g) => (
            <section key={g.h} className="fact-group card-lit" aria-label={g.h}>
              <h2>{g.h}</h2>
              <dl className="facts">
                {g.rows.map(([k, v]) => (
                  <div key={k}>
                    <dt>{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
          <section className="fact-group card-lit" aria-label="Program">
            <h2>Program</h2>
            <CopyField label="Feed account" value={pda} display={`${pda.slice(0, 6)}…${pda.slice(-6)}`} />
            <a href={explorerAddress(pda)} target="_blank" rel="noopener noreferrer" className="proof-link">
              Feed account on Solana Explorer <ArrowUpRight size={14} aria-hidden />
            </a>
          </section>
        </div>
      )}
    </div>
  );
}
