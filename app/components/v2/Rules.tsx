"use client";

import { useId } from "react";
import { effectiveLimitBps } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { MAX_PRICE_AGE_SECS } from "@/lib/position";
import { useWidth } from "./live";
import { useFeedModel } from "./model";

function dur(s: number): string {
  if (s % 3600 === 0) return `${s / 3600}h`;
  if (s >= 3600) return `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
  return `${Math.round(s / 60)}m`;
}

/**
 * What silence does to the SOL limit, computed with the program's own
 * step-down rule (effectiveLimitBps) and the live config. Nothing here is sampled.
 */
export function StepDown() {
  const m = useFeedModel("SOL");
  const [ref, w] = useWidth<HTMLDivElement>(480);
  const clip = `sd${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const p = m.params;
  const f = m.feed;
  const h = 150;
  if (!p || !f || !f.hasValid) {
    return (
      <div ref={ref} className="stepdown is-empty">
        <p>{m.down ? "Solana devnet is not answering." : "Reading the stale rule from the program config"}</p>
      </div>
    );
  }
  const span = Math.max(MAX_PRICE_AGE_SECS * 1.25, p.staleSecs * 6);
  const n = 160;
  const pts = Array.from({ length: n + 1 }, (_, i) => {
    const t = (span * i) / n;
    return { t, v: effectiveLimitBps(true, f.maxLtvBps, 0, Math.floor(t), p.staleSecs, p.staleStepBps, p.staleFloorLtvBps, p.govMaxLtvBps) };
  });
  const top = Math.min(f.maxLtvBps, p.govMaxLtvBps);
  const bot = Math.min(...pts.map((q) => q.v));
  const lo = Math.max(0, bot - 500);
  const hi = top + 300;
  const x = (t: number) => 8 + (t / span) * (w - 16);
  const y = (v: number) => 16 + (1 - (v - lo) / (hi - lo)) * (h - 40);
  let d = "";
  pts.forEach((q, i) => {
    if (i === 0) d = `M${x(q.t).toFixed(1)},${y(q.v).toFixed(1)}`;
    else d += `H${x(q.t).toFixed(1)}V${y(q.v).toFixed(1)}`;
  });
  const pause = x(MAX_PRICE_AGE_SECS);
  return (
    <div ref={ref} className="stepdown">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} role="img" aria-label={`With no fresh data, the SOL limit holds at ${pct1(top)} for ${dur(p.staleSecs)}, then drops ${pct1(p.staleStepBps)} every ${dur(p.staleSecs)}, never below ${pct1(Math.min(p.staleFloorLtvBps, top))}. After ${dur(MAX_PRICE_AGE_SECS)} without a price, borrowing pauses.`}>
        <line x1={pause} x2={pause} y1={8} y2={h - 24} className="sd-pause" />
        <text x={pause + (pause > w - 130 ? -6 : 6)} y={18} className="sd-lbl" textAnchor={pause > w - 130 ? "end" : "start"}>
          borrowing pauses
        </text>
        <clipPath id={clip}>
          <rect className="sd-reveal" x={0} y={0} width={w} height={h} />
        </clipPath>
        <path d={d} className="sd-line" clipPath={`url(#${clip})`} />
        <text x={8} y={y(top) - 8} className="sd-lbl">
          {pct1(top)}
        </text>
        <text x={w - 8} y={y(bot) - 8} className="sd-lbl" textAnchor="end">
          {pct1(bot)}
        </text>
        <line x1={8} x2={w - 8} y1={h - 24} y2={h - 24} className="sd-axis" />
        <text x={8} y={h - 6} className="sd-lbl">
          last good post
        </text>
        <text x={w - 8} y={h - 6} className="sd-lbl" textAnchor="end">
          {dur(Math.round(span))} of silence
        </text>
      </svg>
    </div>
  );
}
