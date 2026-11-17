"use client";

import { useEffect, useRef, useState } from "react";
import type { Feed, Params } from "@/lib/brace";
import {
  bandRange,
  chartDomain,
  curvePoints,
  fmtPrice,
  limitPath,
  niceTicks,
  pct1,
  sigmaT,
} from "@/lib/chart";
import type { LadderQuote } from "@/app/api/ladder/route";

type Ladder = { state: "loading" | "ok" | "unavailable"; quotes: LadderQuote[] };

function useLadder(ticker: string | null): Ladder {
  const [ladder, setLadder] = useState<Ladder>({ state: "loading", quotes: [] });
  useEffect(() => {
    if (!ticker) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetch(`/api/ladder?ticker=${encodeURIComponent(ticker)}`);
        const body = (await res.json()) as { quotes?: LadderQuote[] };
        const quotes = Array.isArray(body.quotes) ? body.quotes : [];
        if (alive) setLadder({ state: quotes.length > 0 ? "ok" : "unavailable", quotes });
      } catch {
        if (alive) setLadder({ state: "unavailable", quotes: [] });
      }
    };
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [ticker]);
  return ticker ? ladder : { state: "unavailable", quotes: [] };
}

function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [w, setW] = useState(fallback);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)));
    ro.observe(el);
    setW(Math.round(el.getBoundingClientRect().width));
    return () => ro.disconnect();
  }, []);
  return [ref, w] as const;
}

/** "5:00 PM ET", or "Nov 20, 5:00 PM ET" when the expiry is not today in New York. */
export function expiryLabel(expiryTs: number, nowSecs: number): string {
  const d = new Date(expiryTs * 1000);
  const tz = "America/New_York";
  const time = d.toLocaleTimeString("en-US", { timeZone: tz, hour: "numeric", minute: "2-digit" });
  const day = (x: Date) => x.toLocaleDateString("en-US", { timeZone: tz, month: "short", day: "numeric" });
  const today = nowSecs > 0 ? day(new Date(nowSecs * 1000)) : day(d);
  return day(d) === today ? `${time} ET` : `${day(d)}, ${time} ET`;
}

function tickLabel(v: number, step: number): string {
  if (v >= 10_000) return `$${Number((v / 1000).toFixed(step >= 1000 ? 0 : 1))}k`;
  const decimals = step >= 1 ? 0 : Math.min(4, Math.ceil(-Math.log10(step)));
  return `$${v.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}`;
}

export function LadderChart({
  symbol,
  feed,
  params,
  now,
  effectiveBps,
}: {
  symbol: string;
  feed: Feed | null;
  params: Params | null;
  now: number;
  effectiveBps: number | null;
}) {
  const [boxRef, width] = useWidth<HTMLDivElement>(640);
  const ladder = useLadder(feed?.ticker || null);

  const compact = width < 520;
  const H = compact ? 236 : 296;
  const m = { l: compact ? 36 : 44, r: 8, t: 28, b: 28 };
  const pw = Math.max(10, width - m.l - m.r);
  const ph = H - m.t - m.b;

  const title = feed ? (
    <>
      {symbol}: what Gemini traders expect by <span className="nw">{expiryLabel(Number(feed.expiryTs), now)}</span>
    </>
  ) : (
    `${symbol}: what Gemini traders expect`
  );

  let body: React.ReactNode = null;
  let aria = `${symbol} chart, reading devnet`;
  let formula: string | null = null;

  if (feed && params) {
    const spot = Number(feed.spotE6) / 1e6;
    const median = Number(feed.medianE6) / 1e6;
    const tFit = Number(feed.expiryTs) - Number(feed.lastValidAt);
    const sT = feed.hasValid ? sigmaT(Number(feed.sigmaBps), tFit) : 0;
    const move = Number(feed.horizonMoveE6) / 1e6;
    const band = move > 0 && spot > 0 ? bandRange(spot, move, params.kX100 / 100) : null;
    const quotes = ladder.quotes;
    const dom = chartDomain({ median, sT, spot, band, strikes: quotes.map((q) => q.strike) });
    const xs = (v: number) => m.l + ((v - dom.min) / (dom.max - dom.min)) * pw;
    const ys = (p: number) => m.t + (1 - p) * ph;

    const xt = niceTicks(dom.min, dom.max, compact ? 3 : 6);
    const step = xt.length > 1 ? xt[1] - xt[0] : 1;
    const yt = compact ? [0, 0.5, 1] : [0, 0.25, 0.5, 0.75, 1];

    const curve =
      median > 0 && sT > 0
        ? curvePoints(median, sT, dom.min, dom.max, 160)
            .map((p, i) => `${i ? "L" : "M"}${xs(p.x).toFixed(1)},${ys(p.y).toFixed(1)}`)
            .join("")
        : null;

    const spotX = xs(spot);
    const spotLabel = `spot ${fmtPrice(spot)}`;
    const spotLabelX = Math.min(Math.max(spotX, m.l + 40), m.l + pw - 40);

    const kLabel = params.kX100 % 100 === 0 ? `${params.kX100 / 100}` : (params.kX100 / 100).toFixed(2);

    body = (
      <>
        {band && (
          <g>
            <rect x={xs(band.lo)} y={m.t} width={Math.max(0, xs(band.hi) - xs(band.lo))} height={ph} fill="var(--raised)" />
            <text x={xs(band.lo) + 6} y={m.t + ph - 8} fontSize="11" fill="var(--text-3)">
              −{kLabel}σ {fmtPrice(band.lo, true)}
            </text>
            <text x={xs(band.hi) - 6} y={m.t + 14} fontSize="11" fill="var(--text-3)" textAnchor="end">
              +{kLabel}σ {fmtPrice(band.hi, true)}
            </text>
          </g>
        )}
        {yt.map((p) => (
          <g key={p}>
            <line x1={m.l} x2={m.l + pw} y1={ys(p)} y2={ys(p)} stroke="var(--hair)" shapeRendering="crispEdges" />
            <text x={m.l - 8} y={ys(p) + 4} fontSize="11" fill="var(--text-3)" textAnchor="end">
              {Math.round(p * 100)}%
            </text>
          </g>
        ))}
        {xt.map((v) => (
          <g key={v}>
            <line x1={xs(v)} x2={xs(v)} y1={m.t + ph} y2={m.t + ph + 4} stroke="var(--text-3)" shapeRendering="crispEdges" />
            <text x={xs(v)} y={m.t + ph + 18} fontSize="11" fill="var(--text-3)" textAnchor="middle">
              {tickLabel(v, step)}
            </text>
          </g>
        ))}
        <line x1={spotX} x2={spotX} y1={m.t - 4} y2={m.t + ph} stroke="var(--text-2)" strokeWidth="1" shapeRendering="crispEdges" />
        <text x={spotLabelX} y={m.t - 10} fontSize="11" fill="var(--text-2)" textAnchor="middle">
          {spotLabel}
        </text>
        {curve && (
          <path d={curve} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {quotes.map((q) => {
          const x = xs(q.strike);
          const mid = (q.bid + q.ask) / 2;
          return (
            <g key={q.strike}>
              <line x1={x} x2={x} y1={ys(q.bid)} y2={ys(q.ask)} stroke="var(--text-2)" strokeWidth="1" />
              <line x1={x - 2.5} x2={x + 2.5} y1={ys(q.bid)} y2={ys(q.bid)} stroke="var(--text-2)" strokeWidth="1" />
              <line x1={x - 2.5} x2={x + 2.5} y1={ys(q.ask)} y2={ys(q.ask)} stroke="var(--text-2)" strokeWidth="1" />
              <circle cx={x} cy={ys(mid)} r="2.75" fill="var(--text)" stroke="var(--card)" strokeWidth="1" />
            </g>
          );
        })}
      </>
    );

    aria =
      `Chance ${symbol} ends at or above each price by ${expiryLabel(Number(feed.expiryTs), now)}. ` +
      (curve ? `Onchain fit: median ${fmtPrice(median)}, implied volatility ${pct1(Number(feed.sigmaBps))}. ` : "No confident fit yet. ") +
      (quotes.length ? `${quotes.length} live Gemini quotes. ` : "Live quotes unavailable. ") +
      `Spot ${fmtPrice(spot)}.` +
      (band ? ` 24 hour ${kLabel} sigma range ${fmtPrice(band.lo)} to ${fmtPrice(band.hi)}.` : "");

    if (feed.hasValid && effectiveBps !== null) {
      formula = limitPath({
        horizonMoveE6: Number(feed.horizonMoveE6),
        kX100: params.kX100,
        liqBps: params.liqThresholdBps,
        floorBps: params.absFloorLtvBps,
        capBps: params.govMaxLtvBps,
        horizonSecs: params.horizonSecs,
        maxLtvBps: feed.maxLtvBps,
        effectiveBps,
      }).text;
    } else if (effectiveBps !== null) {
      formula = `No confident fit yet → limit held at ${pct1(effectiveBps)}`;
    }
  }

  return (
    <figure className="card chart-card" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span>{title}</span>
      </figcaption>
      <div className="chart-box" ref={boxRef}>
        <svg className="chart-svg" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={aria}>
          {body ?? (
            <>
              <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke="var(--hair)" />
              <text x={m.l + pw / 2} y={m.t + ph / 2} fontSize="12" fill="var(--text-3)" textAnchor="middle">
                Reading devnet
              </text>
            </>
          )}
        </svg>
      </div>
      {formula && <p className="formula">{formula}</p>}
      <p className="caption">
        {feed && ladder.state === "unavailable"
          ? "Live quotes unavailable, showing the onchain fit"
          : "Dots: live Gemini quotes. Line: the fit Brace computes onchain."}
      </p>
    </figure>
  );
}
