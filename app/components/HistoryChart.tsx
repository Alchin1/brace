"use client";

import { useEffect, useRef, useState } from "react";
import { niceTicks } from "@/lib/chart";
import {
  formatUtcTime,
  linePath,
  paddedDomain,
  pctFromRatio,
  type ChartPoint,
} from "@/lib/history";

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

export function HistoryChart({
  points,
  t0,
  t1,
  status,
}: {
  points: ChartPoint[];
  t0: number;
  t1: number;
  status: "loading" | "error" | "ok";
}) {
  const [boxRef, width] = useWidth<HTMLDivElement>(640);
  const compact = width < 520;
  const H = compact ? 236 : 280;
  const m = { l: compact ? 42 : 52, r: compact ? 44 : 52, t: 16, b: 28 };
  const pw = Math.max(10, width - m.l - m.r);
  const ph = H - m.t - m.b;
  const x = (ts: number) => m.l + ((ts - t0) / Math.max(1, t1 - t0)) * pw;

  const ltvDom = paddedDomain(
    points.map((p) => p.effectiveLtv),
    1,
    [0.5, 0.8],
    0.1,
  );
  const volDom = paddedDomain(
    points.map((p) => p.sigmaAnnual),
    4,
    [0.2, 1.2],
    0.25,
  );
  const yLtv = (v: number) => m.t + (1 - (v - ltvDom.min) / (ltvDom.max - ltvDom.min)) * ph;
  const yVol = (v: number) => m.t + (1 - (v - volDom.min) / (volDom.max - volDom.min)) * ph;

  const xt = (() => {
    const hour = 3600;
    const span = t1 - t0;
    const hours = [compact ? 8 : 4, 6, 8, 12].find((h) => span / (h * hour) <= (compact ? 4 : 7)) ?? 12;
    const step = hours * hour;
    const start = Math.ceil(t0 / step) * step;
    const out: number[] = [];
    for (let t = start; t <= t1 + 1e-6; t += step) out.push(t);
    return out;
  })();

  const awayFromEdge = (y: number) => y > m.t + 10 && y < m.t + ph - 12;
  const ltvTicks = niceTicks(ltvDom.min, ltvDom.max, compact ? 3 : 4).filter((v) => awayFromEdge(yLtv(v)));
  const volTicks = niceTicks(volDom.min, volDom.max, compact ? 3 : 4).filter((v) => awayFromEdge(yVol(v)));

  const limitLine = linePath(points.map((p) => ({ x: x(p.ts), y: yLtv(p.effectiveLtv) })));
  const volLine = linePath(points.map((p) => ({ x: x(p.ts), y: yVol(p.sigmaAnnual) })));

  let aria = "SOL effective limit and implied volatility over the last 24 hours.";
  if (status === "loading") aria = "Reading SOL history from Streams.";
  if (status === "error") aria = "Could not load SOL history.";
  if (status === "ok" && points.length) {
    const last = points[points.length - 1];
    aria += ` Latest limit ${pctFromRatio(last.effectiveLtv)}, implied volatility ${pctFromRatio(last.sigmaAnnual)}, ${points.length} Stream rows.`;
  }
  if (status === "ok" && !points.length) aria += " No Stream rows in the last 24 hours.";

  let body: React.ReactNode;
  if (status === "loading") {
    body = (
      <>
        <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke="var(--hair)" />
        <text x={m.l + pw / 2} y={m.t + ph / 2} fontSize="12" fill="var(--text-3)" textAnchor="middle">
          Reading Streams
        </text>
      </>
    );
  } else if (status === "error") {
    body = (
      <>
        <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke="var(--hair)" />
        <text x={m.l + pw / 2} y={m.t + ph / 2} fontSize="12" fill="var(--text-3)" textAnchor="middle">
          Could not load history
        </text>
      </>
    );
  } else if (!points.length) {
    body = (
      <>
        <line x1={m.l} x2={m.l + pw} y1={m.t + ph} y2={m.t + ph} stroke="var(--hair)" />
        <text x={m.l + pw / 2} y={m.t + ph / 2} fontSize="12" fill="var(--text-3)" textAnchor="middle">
          No Stream rows in the last 24 hours
        </text>
      </>
    );
  } else {
    body = (
      <>
        {ltvTicks.map((v) => (
          <g key={`l-${v}`}>
            <line x1={m.l} x2={m.l + pw} y1={yLtv(v)} y2={yLtv(v)} stroke="var(--hair)" shapeRendering="crispEdges" />
            <text x={m.l - 8} y={yLtv(v) + 4} fontSize="11" fill="var(--accent)" textAnchor="end">
              {pctFromRatio(v)}
            </text>
          </g>
        ))}
        {volTicks.map((v) => (
          <text key={`v-${v}`} x={m.l + pw + 8} y={yVol(v) + 4} fontSize="11" fill="var(--text-3)" textAnchor="start">
            {pctFromRatio(v)}
          </text>
        ))}
        {xt.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={m.t + ph} y2={m.t + ph + 4} stroke="var(--text-3)" shapeRendering="crispEdges" />
            <text x={x(t)} y={m.t + ph + 18} fontSize="11" fill="var(--text-3)" textAnchor="middle">
              {formatUtcTime(t).replace(" UTC", "")}
            </text>
          </g>
        ))}
        {volLine && (
          <path d={volLine} fill="none" stroke="var(--text-2)" strokeWidth="1.25" strokeLinejoin="round" strokeLinecap="round" />
        )}
        {limitLine && (
          <path d={limitLine} fill="none" stroke="var(--accent)" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
        )}
      </>
    );
  }

  return (
    <figure className="card chart-card" style={{ margin: 0 }}>
      <figcaption className="chart-head">
        <span>SOL: effective limit and implied volatility, last 24 hours</span>
        <span className="legend">
          <span className="legend-item">
            <span className="legend-line accent" aria-hidden />
            Effective limit
          </span>
          <span className="legend-item">
            <span className="legend-line muted" aria-hidden />
            Implied vol
          </span>
        </span>
      </figcaption>
      <div className="chart-box" ref={boxRef}>
        <svg className="chart-svg" width={width} height={H} viewBox={`0 0 ${width} ${H}`} role="img" aria-label={aria}>
          {body}
        </svg>
      </div>
      <p className="caption">Times in UTC. The accent line is the effective borrow limit. The neutral line is implied volatility.</p>
    </figure>
  );
}
