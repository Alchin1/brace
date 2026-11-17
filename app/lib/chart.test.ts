import { describe, expect, it } from "vitest";
import {
  bandRange,
  chartDomain,
  curvePoints,
  fmtPrice,
  limitPath,
  niceTicks,
  normCdf,
  probAbove,
  sigmaT,
  strikeAtProb,
  YEAR_SECS,
} from "./chart";

describe("normCdf", () => {
  it("matches known values", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 7);
    expect(normCdf(1)).toBeCloseTo(0.841345, 5);
    expect(normCdf(-1.96)).toBeCloseTo(0.024998, 5);
    expect(normCdf(3)).toBeCloseTo(0.99865, 5);
  });
});

describe("lognormal curve", () => {
  const F = 72.8;
  const sT = sigmaT(7960, 6 * 3600); // 79.6% annual over 6 hours

  it("sigmaT scales with sqrt of time", () => {
    expect(sigmaT(10000, YEAR_SECS)).toBeCloseTo(1, 10);
    expect(sigmaT(10000, YEAR_SECS / 4)).toBeCloseTo(0.5, 10);
    expect(sigmaT(8000, 0)).toBe(0);
  });

  it("passes 50% at the median", () => {
    expect(probAbove(F, F, sT)).toBeCloseTo(0.5, 6);
  });

  it("is monotonic decreasing in strike", () => {
    const pts = curvePoints(F, sT, 60, 85, 200);
    expect(pts).toHaveLength(200);
    expect(pts[0].x).toBe(60);
    expect(pts[199].x).toBe(85);
    for (let i = 1; i < pts.length; i++) expect(pts[i].y).toBeLessThanOrEqual(pts[i - 1].y);
    // Strictly decreasing where the curve is not saturated.
    const mid = curvePoints(F, sT, 69, 77, 100);
    for (let i = 1; i < mid.length; i++) expect(mid[i].y).toBeLessThan(mid[i - 1].y);
    expect(pts[0].y).toBeGreaterThan(0.99);
    expect(pts[199].y).toBeLessThan(0.01);
  });

  it("degenerate sT gives a step at the median", () => {
    expect(probAbove(70, F, 0)).toBe(1);
    expect(probAbove(75, F, 0)).toBe(0);
  });

  it("strikeAtProb inverts probAbove", () => {
    for (const p of [0.02, 0.25, 0.5, 0.75, 0.98]) {
      expect(probAbove(strikeAtProb(F, sT, p), F, sT)).toBeCloseTo(p, 6);
    }
  });
});

describe("band", () => {
  it("is spot times 1 plus or minus 3 horizon moves", () => {
    const b = bandRange(72.41, 0.0327);
    expect(b.movePct).toBeCloseTo(9.81, 10);
    expect(b.lo).toBeCloseTo(72.41 * (1 - 0.0981), 10);
    expect(b.hi).toBeCloseTo(72.41 * (1 + 0.0981), 10);
  });
  it("never goes below zero", () => {
    expect(bandRange(10, 0.5).lo).toBe(0);
  });
});

describe("domain and ticks", () => {
  it("covers band, spot and strikes", () => {
    const d = chartDomain({ median: 72.8, sT: 0.04, spot: 72.4, band: { lo: 65, hi: 80 }, strikes: [60, 86] });
    expect(d.min).toBeLessThanOrEqual(60);
    expect(d.max).toBeGreaterThanOrEqual(86);
  });
  it("gives round ticks inside the range", () => {
    expect(niceTicks(63.2, 81.7, 5)).toEqual([65, 70, 75, 80]);
    expect(niceTicks(0, 1, 4)).toEqual([0, 0.25, 0.5, 0.75, 1]);
  });
  it("formats prices by size", () => {
    expect(fmtPrice(72.41)).toBe("$72.41");
    expect(fmtPrice(0.9312)).toBe("$0.9312");
    expect(fmtPrice(64800)).toBe("$64,800");
    expect(fmtPrice(64800, true)).toBe("$64.8k");
  });
});

const base = { kX100: 300, liqBps: 8000, floorBps: 3000, capBps: 7500, horizonSecs: 86_400 };

describe("limitPath", () => {
  it("uncapped: shows the raw limit", () => {
    // 24h 1-sigma move 3.27% -> 3 sigma 9.81% -> 80% x 0.9019 = 72.15% -> 7215 bps
    const p = limitPath({ ...base, horizonMoveE6: 32_700, maxLtvBps: 7215, effectiveBps: 7215 });
    expect(p.rawBps).toBe(7215);
    expect(p.text).toBe("3σ 24h move ±9.8% → limit 80% × (1 − 0.098) = 72.2%");
  });
  it("capped at the governance max", () => {
    const p = limitPath({ ...base, horizonMoveE6: 10_000, maxLtvBps: 7500, effectiveBps: 7500 });
    expect(p.rawBps).toBe(7760);
    expect(p.text).toBe("3σ 24h move ±3.0% → limit 80% × (1 − 0.030) = 77.6% → capped 75.0%");
  });
  it("floored", () => {
    const p = limitPath({ ...base, horizonMoveE6: 200_000, maxLtvBps: 3200, effectiveBps: 3200 });
    expect(p.text).toBe("3σ 24h move ±60.0% → limit 80% × (1 − 0.600) = 32.0%");
    const q = limitPath({ ...base, horizonMoveE6: 250_000, maxLtvBps: 3000, effectiveBps: 3000 });
    expect(q.text).toBe("3σ 24h move ±75.0% → limit 80% × (1 − 0.750) = 20.0% → floored 30.0%");
  });
  it("stale: shows the step down", () => {
    const p = limitPath({ ...base, horizonMoveE6: 32_700, maxLtvBps: 7215, effectiveBps: 6715 });
    expect(p.text).toBe("3σ 24h move ±9.8% → limit 80% × (1 − 0.098) = 72.2% → stale, stepped down to 67.2%");
  });
  it("names the last confident limit when the move changed since", () => {
    const p = limitPath({ ...base, horizonMoveE6: 10_000, maxLtvBps: 7000, effectiveBps: 7000 });
    expect(p.text).toBe("3σ 24h move ±3.0% → limit 80% × (1 − 0.030) = 77.6% → capped 75.0% → last confident limit 70.0%");
  });
});
