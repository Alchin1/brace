// Pure math for the ladder chart: the lognormal fit curve, the 3-sigma band,
// axis domain and ticks, and the limit formula line. No DOM, no fetches.
//
// The curve: P(S_T >= K) = N(ln(F / K) / sT), where F is the Feed's implied median
// (median_e6) and sT = sigma_annual * sqrt(T / year). sigma_annual is the Feed's
// sigma_bps / 10_000 and T = expiry_ts - last_valid_at: the time to expiry when the
// program made the fit, so the drawn curve is exactly the fit stored onchain.

export const YEAR_SECS = 31_536_000;

/** Standard normal CDF (Abramowitz and Stegun 7.1.26 via erf, error < 1.5e-7). */
export function normCdf(x: number): number {
  const z = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + 0.3275911 * z);
  const poly = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429))));
  const erf = 1 - poly * Math.exp(-z * z);
  return x >= 0 ? 0.5 * (1 + erf) : 0.5 * (1 - erf);
}

/** Total volatility to expiry: sigma_annual * sqrt(t / year). */
export function sigmaT(sigmaBps: number, tSecs: number): number {
  if (!(tSecs > 0) || !(sigmaBps > 0)) return 0;
  return (sigmaBps / 10_000) * Math.sqrt(tSecs / YEAR_SECS);
}

/** Probability the price ends at or above strike k. */
export function probAbove(k: number, f: number, sT: number): number {
  if (!(sT > 0)) return k <= f ? 1 : 0;
  return normCdf(Math.log(f / k) / sT);
}

/** Strike where probAbove equals p (bisection on log price; deterministic). */
export function strikeAtProb(f: number, sT: number, p: number): number {
  if (!(sT > 0)) return f;
  let lo = Math.log(f) - 12 * sT;
  let hi = Math.log(f) + 12 * sT;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (probAbove(Math.exp(mid), f, sT) > p) lo = mid;
    else hi = mid;
  }
  return Math.exp((lo + hi) / 2);
}

export type Pt = { x: number; y: number };

/** n evenly spaced curve points over [x0, x1]. */
export function curvePoints(f: number, sT: number, x0: number, x1: number, n = 120): Pt[] {
  const out: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const x = i === n - 1 ? x1 : x0 + ((x1 - x0) * i) / (n - 1);
    out.push({ x, y: probAbove(Math.max(x, 1e-12), f, sT) });
  }
  return out;
}

/** The 24h k-sigma range around spot: spot * (1 +/- k * move). */
export function bandRange(spot: number, horizonMove: number, k = 3): { lo: number; hi: number; movePct: number } {
  const m = k * horizonMove;
  return { lo: Math.max(0, spot * (1 - m)), hi: spot * (1 + m), movePct: m * 100 };
}

/** x range covering the fit's 1%..99% region, the band, spot and every quoted strike, padded 4%. */
export function chartDomain(o: {
  median: number;
  sT: number;
  spot: number;
  band: { lo: number; hi: number } | null;
  strikes: number[];
}): { min: number; max: number } {
  const xs = [o.spot, ...o.strikes];
  if (o.median > 0 && o.sT > 0) xs.push(strikeAtProb(o.median, o.sT, 0.99), strikeAtProb(o.median, o.sT, 0.01));
  if (o.band) xs.push(o.band.lo, o.band.hi);
  const finite = xs.filter((x) => Number.isFinite(x) && x > 0);
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (!(max > min)) {
    min = min * 0.95;
    max = max * 1.05;
  }
  const pad = (max - min) * 0.04;
  return { min: Math.max(0, min - pad), max: max + pad };
}

/** Round ticks (1, 2, 2.5 or 5 times a power of ten) inside [min, max], about `count` of them. */
export function niceTicks(min: number, max: number, count: number): number[] {
  if (!(max > min)) return [min];
  const raw = (max - min) / Math.max(1, count);
  const pow = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * pow).find((s) => s >= raw) ?? 10 * pow;
  const out: number[] = [];
  const start = Math.ceil(min / step - 1e-9);
  for (let i = start; i * step <= max + 1e-9 * step; i++) out.push(Number((i * step).toPrecision(12)));
  return out;
}

/** $72.41, $0.9312, $64,800, compact $64.8k. */
export function fmtPrice(v: number, compact = false): string {
  if (compact && v >= 10_000) return `$${Number((v / 1000).toFixed(1))}k`;
  if (v >= 1000) return `$${v.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
  if (v >= 1) return `$${v.toFixed(2)}`;
  return `$${v.toFixed(4)}`;
}

/** Basis points to a percent with one decimal, rounding half up on the integer bps. */
export function pct1(bps: number): string {
  return `${(Math.round(bps / 10) / 10).toFixed(1)}%`;
}

export function horizonLabel(secs: number): string {
  if (secs % 3600 === 0) return `${secs / 3600}h`;
  return `${Math.round(secs / 60)}m`;
}

/**
 * The limit formula as the program computes it (math.rs vol_limit_bps):
 * raw = liq * (1 - (k/100) * move), floored to bps, then clamped to [floor, cap],
 * then the stale step-down. Builds the one-line explanation from live numbers.
 */
export function limitPath(o: {
  horizonMoveE6: number;
  kX100: number;
  liqBps: number;
  floorBps: number;
  capBps: number;
  horizonSecs: number;
  maxLtvBps: number;
  effectiveBps: number;
}): { rawBps: number; clampedBps: number; text: string } {
  const DEN = 100 * 1_000_000;
  const m = o.kX100 * o.horizonMoveE6;
  const rawBps = m >= DEN ? 0 : Math.floor((o.liqBps * (DEN - m)) / DEN);
  const clampedBps = Math.min(Math.max(rawBps, o.floorBps), o.capBps);
  const k = o.kX100 / 100;
  const kLabel = Number.isInteger(k) ? `${k}` : k.toFixed(2);
  const term = m / DEN;
  const parts = [
    `${kLabel}σ ${horizonLabel(o.horizonSecs)} move ±${(term * 100).toFixed(1)}%`,
    `limit ${pct1(o.liqBps).replace(".0%", "%")} × (1 − ${term.toFixed(3)}) = ${pct1(rawBps)}`,
  ];
  if (rawBps > o.capBps) parts.push(`capped ${pct1(o.capBps)}`);
  else if (rawBps < o.floorBps) parts.push(`floored ${pct1(o.floorBps)}`);
  if (o.maxLtvBps !== clampedBps) parts.push(`last confident limit ${pct1(o.maxLtvBps)}`);
  if (o.effectiveBps < o.maxLtvBps) parts.push(`stale, stepped down to ${pct1(o.effectiveBps)}`);
  return { rawBps, clampedBps, text: parts.join(" → ") };
}
