"use client";

import { useId } from "react";
import { pct1 } from "@/lib/chart";
import { useWidth } from "./live";

/**
 * A horizontal curly brace from (x0, y) to (x1, y), tip pointing up by h.
 * The Brace signature: it spans exactly what you may borrow.
 */
export function bracePath(x0: number, x1: number, y: number, h: number): string {
  const w = Math.max(0, x1 - x0);
  const a = Math.max(0.5, Math.min(h / 2, w / 4));
  const m = (x0 + x1) / 2;
  const t = y - h;
  const mid = y - a;
  if (w < 4) return `M${x0},${y}L${x0},${t}`;
  return [
    `M${x0},${y}`,
    `Q${x0},${mid} ${x0 + a},${mid}`,
    `L${m - a},${mid}`,
    `Q${m},${mid} ${m},${t}`,
    `Q${m},${mid} ${m + a},${mid}`,
    `L${x1 - a},${mid}`,
    `Q${x1},${mid} ${x1},${y}`,
  ].join(" ");
}

/**
 * The limit gauge: a 0 to 100% scale with a brace over everything you may
 * borrow, the governance cap, the liquidation line, the buffer between the
 * limit and liquidation hatched, and an optional position mark.
 */
export function BraceGauge({
  limitBps,
  capBps = 7500,
  liqBps = 8000,
  markBps = null,
  markLabel = "you",
  tone,
  compact = false,
  label,
  className = "",
  decorative = false,
}: {
  limitBps: number | null;
  capBps?: number;
  liqBps?: number;
  markBps?: number | null;
  markLabel?: string;
  tone?: "stale" | "over";
  compact?: boolean;
  label?: string;
  className?: string;
  decorative?: boolean;
}) {
  const id = useId().replace(/:/g, "");
  const [ref, w] = useWidth<HTMLDivElement>(compact ? 240 : 560);
  const H = compact ? 46 : 74;
  const base = compact ? 30 : 48;
  const pad = 1;
  const x = (bps: number) => pad + (Math.min(10000, Math.max(0, bps)) / 10000) * (w - pad * 2);
  const over = tone === "over" || (markBps !== null && limitBps !== null && markBps > limitBps);
  const ticks = compact ? [0, 5000, 10000] : w < 420 ? [0, 2500, 5000, 7500, 10000] : [0, 1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000, 10000];
  const aria =
    label ??
    (limitBps === null
      ? "Limit not read yet"
      : `Borrow up to ${pct1(limitBps)} of collateral value. Cap ${pct1(capBps)}, liquidation at ${pct1(liqBps)}, buffer ${((liqBps - limitBps) / 100).toFixed(1)} points${markBps !== null ? `. ${markLabel} at ${pct1(markBps)}` : ""}.`);
  const braceH = compact ? 12 : 18;
  const braceY = base - (compact ? 6 : 10);
  return (
    <div ref={ref} className={`bg${compact ? " is-compact" : ""}${tone === "stale" ? " is-stale" : ""}${over ? " is-over" : ""} ${className}`} {...(decorative ? { "aria-hidden": true } : { role: "img", "aria-label": aria })}>
      <svg width={w} height={H} viewBox={`0 0 ${w} ${H}`} aria-hidden focusable="false">
        <defs>
          <pattern id={`h${id}`} width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" x2="0" y1="0" y2="6" className="bg-hatch" />
          </pattern>
          <pattern id={`o${id}`} width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <line x1="0" x2="0" y1="0" y2="5" className="bg-hatch-over" />
          </pattern>
        </defs>
        <line x1={x(0)} x2={x(10000)} y1={base} y2={base} className="bg-axis" />
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={base} y2={base + 4} className="bg-tick" />
            {!compact && (
              <text x={Math.min(Math.max(x(t), 8), w - 12)} y={base + 18} className="bg-num" textAnchor="middle">
                {t / 100}
              </text>
            )}
          </g>
        ))}
        {limitBps !== null && (
          <>
            <rect x={x(limitBps)} y={base - 8} width={Math.max(0, x(liqBps) - x(limitBps))} height={8} fill={`url(#h${id})`} className="bg-buffer" />
            <rect x={x(0)} y={base - 3} width={Math.max(0, x(limitBps) - x(0))} height={3} className="bg-fill" />
            <path d={bracePath(x(0) + 1, x(limitBps) - 1, braceY, braceH)} className="bg-brace" />
          </>
        )}
        {over && markBps !== null && limitBps !== null && (
          <rect x={x(limitBps)} y={base - 10} width={Math.max(0, x(Math.min(markBps, 10000)) - x(limitBps))} height={10} fill={`url(#o${id})`} />
        )}
        <line x1={x(capBps)} x2={x(capBps)} y1={base - (compact ? 14 : 22)} y2={base + 4} className="bg-cap" />
        <line x1={x(liqBps)} x2={x(liqBps)} y1={base - (compact ? 14 : 22)} y2={base + 4} className="bg-liq" />
        {!compact && (
          <>
            <text x={x(capBps) - 4} y={base - 26} className="bg-lbl" textAnchor="end">
              cap
            </text>
            <text x={x(liqBps) + 4} y={base - 26} className="bg-lbl" textAnchor="start">
              {w < 480 ? "liq" : "liquidation"}
            </text>
          </>
        )}
        {markBps !== null && (
          <g className="bg-mark">
            <line x1={x(Math.min(markBps, 10000))} x2={x(Math.min(markBps, 10000))} y1={base - (compact ? 16 : 26)} y2={base + 6} />
            <circle cx={x(Math.min(markBps, 10000))} cy={base - (compact ? 16 : 26)} r="3" />
          </g>
        )}
      </svg>
    </div>
  );
}
