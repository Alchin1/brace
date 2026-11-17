"use client";

import { useEffect, useState } from "react";
import { useInViewOnce } from "./hooks";

/*
 * Tiny SVG line of real readings (e.g. the last 12 hours of a feed's limit from /history).
 * The line draws itself once when it scrolls into view (stroke-dashoffset on pathLength=1),
 * which is the "data arriving" motion motionsites dashboards use, without fake data.
 * Reduced motion: drawn immediately. Fewer than 2 points: renders nothing.
 */

type Props = {
  points: number[];
  width?: number;
  height?: number;
  /** Required: what the line shows, e.g. "SOL limit over the last 12 hours, 68.9% to 69.2%". */
  label: string;
  /** Optional fixed scale so several sparklines are comparable. */
  min?: number;
  max?: number;
};

export function Sparkline({ points, width = 120, height = 32, label, min, max }: Props) {
  const [ref, seen] = useInViewOnce<SVGSVGElement>();
  // Server HTML shows the full line; the draw-in is armed only after hydration, so the line
  // is never missing if scripts fail.
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(true), []);
  if (points.length < 2) return null;
  const lo = min ?? Math.min(...points);
  const hi = max ?? Math.max(...points);
  const span = hi - lo || 1;
  const pad = 2;
  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (width - pad * 2);
    const y = pad + (1 - (p - lo) / span) * (height - pad * 2);
    return [x, y] as const;
  });
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg ref={ref} className="rv-spark" data-armed={armed ? "" : undefined} data-seen={seen ? "" : undefined} width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={label}>
      <path d={d} pathLength={1} className="rv-spark-line" fill="none" />
      <circle cx={lx} cy={ly} r={2.5} className="rv-spark-end" />
    </svg>
  );
}
