"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { SYMBOLS, type Symbol } from "@/lib/brace";
import { historyUrl, parseHistory } from "@/lib/history";
import { fetchWithTimeout } from "@/lib/net";
import { useSeen } from "./hooks";

/** Effective-limit readings per asset, from the relayer's /history (real rows only). */
type Series = { ts: number; v: number }[];
type Sparks = { windowSecs: number; data: Partial<Record<Symbol, Series>>; state: "idle" | "loading" | "ok" | "error" };

const SparkCtx = createContext<Sparks>({ windowSecs: 0, data: {}, state: "idle" });
const REFRESH_MS = 120_000;

/**
 * Loads a short window of /history for the given assets, but only after the
 * wrapped block has scrolled into view. Rows are thinned to at most 48 points.
 */
export function SparkProvider({
  symbols = SYMBOLS,
  windowSecs = 2 * 3600,
  children,
  className,
}: {
  symbols?: readonly Symbol[];
  windowSecs?: number;
  children: ReactNode;
  className?: string;
}) {
  const [ref, seen] = useSeen<HTMLDivElement>("200px 0px");
  const [sparks, setSparks] = useState<Sparks>({ windowSecs, data: {}, state: "idle" });
  const key = symbols.join(",");

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    const load = async () => {
      const since = Math.floor(Date.now() / 1000) - windowSecs;
      setSparks((s) => (s.state === "ok" ? s : { ...s, state: "loading" }));
      const out: Partial<Record<Symbol, Series>> = {};
      await Promise.all(
        key.split(",").map(async (sym) => {
          try {
            const res = await fetchWithTimeout(historyUrl(sym, since));
            if (!res.ok) return;
            const rows = parseHistory(await res.json())
              .filter((r) => r.ts >= since)
              .sort((a, b) => a.ts - b.ts);
            const step = Math.max(1, Math.ceil(rows.length / 48));
            out[sym as Symbol] = rows.filter((_, i) => i % step === 0 || i === rows.length - 1).map((r) => ({ ts: r.ts, v: r.effective_ltv }));
          } catch {
            // Leave this asset without a line.
          }
        }),
      );
      if (!alive) return;
      setSparks({ windowSecs, data: out, state: Object.keys(out).length ? "ok" : "error" });
    };
    load();
    const t = setInterval(load, REFRESH_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [seen, key, windowSecs]);

  return (
    <div ref={ref} className={className}>
      <SparkCtx.Provider value={sparks}>{children}</SparkCtx.Provider>
    </div>
  );
}

export function useSpark(sym: Symbol) {
  const s = useContext(SparkCtx);
  return { series: s.data[sym] ?? null, state: s.state, windowSecs: s.windowSecs };
}

/** A small line of the effective limit. Draws nothing until real rows exist. */
export function Sparkline({ sym, width = 96, height = 28, className = "" }: { sym: Symbol; width?: number; height?: number; className?: string }) {
  const { series, state, windowSecs } = useSpark(sym);
  if (!series || series.length < 2) {
    return <span className={`spark spark-empty ${state === "loading" || state === "idle" ? "is-loading" : ""} ${className}`} style={{ width, height }} aria-hidden />;
  }
  const t0 = series[0].ts;
  const t1 = series[series.length - 1].ts;
  let lo = Math.min(...series.map((p) => p.v));
  let hi = Math.max(...series.map((p) => p.v));
  if (hi - lo < 0.004) {
    const mid = (hi + lo) / 2;
    lo = mid - 0.002;
    hi = mid + 0.002;
  }
  const x = (ts: number) => 1 + ((ts - t0) / Math.max(1, t1 - t0)) * (width - 2);
  const y = (v: number) => 2 + (1 - (v - lo) / (hi - lo)) * (height - 4);
  const d = series.map((p, i) => `${i ? "L" : "M"}${x(p.ts).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = `${d}L${x(t1).toFixed(1)},${height}L${x(t0).toFixed(1)},${height}Z`;
  const first = series[0].v;
  const last = series[series.length - 1].v;
  const hours = Math.round(windowSecs / 3600);
  return (
    <svg
      className={`spark ${className}`}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`${sym} limit over the last ${hours} hours, from ${(first * 100).toFixed(1)}% to ${(last * 100).toFixed(1)}%`}
    >
      <path className="spark-area" d={area} />
      <path className="spark-line" d={d} />
      <circle className="spark-dot" cx={x(t1)} cy={y(last)} r="2" />
    </svg>
  );
}
