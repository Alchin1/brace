"use client";

import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { SYMBOLS, feedEffectiveLtvBps, feedStatus, relTime } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { BoardNotice, useBoard } from "./BoardProvider";
import { ASSET_NAMES, StatusCell } from "./Instruments";
import { LadderChart } from "./LadderChart";
import { AssetGlyph } from "./ui/AssetGlyph";
import { BlockMeter, LimitRing } from "./ui/Meters";
import { RollingNumber } from "./ui/RollingNumber";
import { Sparkline } from "./ui/Sparks";

/** Vol on a 0 to 150% scale for the block meter (display only). */
const volScaleBps = (sigmaBps: number) => Math.min(10000, (sigmaBps / 15000) * 10000);

/** SOL instruments under the hero: limit ring, vol meter with sparkline. */
export function HeroReading() {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok?.feeds.SOL ?? null;
  const p = ok?.config.params ?? null;
  const status = ok ? feedStatus(f, ok.config.params, now) : null;
  const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
  const cap = p?.govMaxLtvBps ?? 7500;
  const liq = p?.liqThresholdBps ?? 8000;
  const loading = state === null;
  const down = state?.kind === "error";

  return (
    <div className={`kpis${loading ? " is-loading" : ""}`} aria-label="SOL right now">
      <div className="kpi kpi-ring card-lit">
        <LimitRing
          limitBps={limit}
          capBps={cap}
          liqBps={liq}
          size={132}
          tone={status === "stale" ? "stale" : undefined}
          center={<span className="ring-v">{limit === null ? (loading ? <span className="skel skel-num" /> : "--") : <RollingNumber value={pct1(limit)} />}</span>}
          sub="SOL limit"
        />
        <ul className="kpi-legend">
          <li>
            <i className="k-acc" /> Live limit
          </li>
          <li>
            <i className="k-cap" /> Cap {pct1(cap)}
          </li>
          <li>
            <i className="k-liq" /> Liquidation {pct1(liq)}
          </li>
        </ul>
      </div>
      <div className="kpi kpi-vol card-lit">
        <span className="kpi-k">SOL implied volatility</span>
        <span className="kpi-v">{f ? <RollingNumber value={pct1(Number(f.sigmaBps))} /> : loading ? <span className="skel skel-num" /> : "--"}</span>
        <BlockMeter valueBps={f ? volScaleBps(Number(f.sigmaBps)) : null} capBps={null} label={`Implied volatility ${f ? pct1(Number(f.sigmaBps)) : "not read yet"} on a 0 to 150% scale`} />
        <span className="kpi-scale" aria-hidden>
          <span>0%</span>
          <span>150%</span>
        </span>
      </div>
      <div className="kpi kpi-spark card-lit">
        <span className="kpi-k">SOL limit, last 2 hours</span>
        <Sparkline sym="SOL" width={220} height={56} className="kpi-sparkline" />
        <span className="kpi-meta">
          <StatusCell status={status} />
          <span className="muted">
            {down ? "devnet not answering" : f ? `posted ${relTime(now - Number(f.postedAt))}` : loading ? "reading devnet" : "--"}
          </span>
        </span>
      </div>
    </div>
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
      <div className="feed" role="table" aria-label="Borrowing limit per asset">
        <div className="frow feed-head" role="row">
          <span role="columnheader">Asset</span>
          <span role="columnheader" className="c-spark">
            Limit, 2h
          </span>
          <span role="columnheader" className="c-vol r">
            Implied vol
          </span>
          <span role="columnheader" className="c-meter">
            Limit vs {pct1(cap)} cap
          </span>
          <span role="columnheader" className="r">
            Limit
          </span>
          <span role="columnheader" className="c-status">
            Status
          </span>
        </div>
        {SYMBOLS.map((s) => {
          const f = ok ? ok.feeds[s] : null;
          const status = ok ? feedStatus(f, ok.config.params, now) : null;
          const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
          const vol = f ? pct1(Number(f.sigmaBps)) : "--";
          return (
            <Link key={s} href={`/asset/${s}`} className="frow" role="row">
              <span role="cell" className="c-asset">
                <AssetGlyph sym={s} size={36} />
                <span className="asset-name">
                  <span className="sym">{s}</span>
                  <span className="name">{ASSET_NAMES[s]}</span>
                </span>
              </span>
              <span role="cell" className="c-spark">
                <Sparkline sym={s} width={112} height={32} />
              </span>
              <span role="cell" className="c-vol r num">
                <span className="m-k">Vol</span>
                {vol}
              </span>
              <span role="cell" className="c-meter">
                <BlockMeter valueBps={limit} capBps={cap} label={`${s} limit ${limit === null ? "not read yet" : pct1(limit)}, cap ${pct1(cap)}`} />
              </span>
              <span role="cell" className="r c-limit">
                <span className="m-k">Limit</span>
                <span className="limit-val">{limit === null ? (state === null ? <span className="skel skel-num" /> : "--") : <RollingNumber value={pct1(limit)} />}</span>
              </span>
              <span role="cell" className="c-status">
                <StatusCell status={status} compact />
                <ArrowUpRight size={16} className="row-go" aria-hidden />
              </span>
              <span className="c-ring" aria-hidden>
                <LimitRing limitBps={limit} capBps={cap} liqBps={liq} size={64} center={<span />} label="" />
              </span>
            </Link>
          );
        })}
      </div>
    </>
  );
}
