import { describe, expect, it } from "vitest";
import {
  actionsUrl,
  borrowActions,
  formatBorrowAction,
  formatUtcDateTime,
  formatUtcTime,
  historyUrl,
  linePath,
  paddedDomain,
  parseActions,
  parseHistory,
  pctFromBps,
  pctFromRatio,
  seriesForChart,
  timeTicks,
} from "./history";

const post = {
  ts: 1_794_906_862,
  asset: "SOL",
  spot: 72.174,
  median: 72.014731,
  sigma_annual: 0.8438,
  horizon_secs: 86400,
  k: 3,
  max_ltv: 0.6939,
  effective_ltv: 0.6939,
  confident: true,
  points: 8,
  expiry_ts: 1_794_952_800,
  ticker: "SOL2611172200",
  tx: "5cwQA5BzCHPZPJTDbs6bRiPX649mQr8v4vj8C2kXusPayhZk6pL5mmMC9nJtuKHqzw5ad2mhjHiFrgwNjRajcgNB",
};

describe("urls", () => {
  it("builds the documented history and actions endpoints", () => {
    expect(historyUrl("SOL", 1794820000)).toBe(
      "https://brace-relayer.ohjaye0.workers.dev/history?asset=SOL&since=1794820000",
    );
    expect(actionsUrl(1794820000)).toBe(
      "https://brace-relayer.ohjaye0.workers.dev/actions?since=1794820000",
    );
  });
});

describe("parseHistory", () => {
  it("keeps well-formed rows and drops junk", () => {
    const rows = parseHistory([post, { ts: 1, asset: "SOL" }, null, "nope"]);
    expect(rows).toHaveLength(1);
    expect(rows[0].effective_ltv).toBe(0.6939);
    expect(rows[0].sigma_annual).toBe(0.8438);
    expect(rows[0].confident).toBe(true);
  });

  it("rejects a non-array body", () => {
    expect(() => parseHistory({ rows: [post] })).toThrow(/not an array/);
  });
});

describe("parseActions", () => {
  it("parses blocked and accepted borrows; ltv and limit stay in basis points", () => {
    const rows = parseActions([
      {
        ts: 100,
        kind: "blocked",
        owner: "Owner111",
        amount: null,
        ltv: 7987,
        limit: 6987,
        ok: false,
        tx: "SigBlocked111",
        error: "RiskTightened",
      },
      {
        ts: 200,
        kind: "borrow",
        owner: "Owner111",
        amount: 1_000_000,
        ltv: 4010,
        limit: 6987,
        ok: true,
        tx: "SigOk111",
        error: null,
      },
      { ts: 300, kind: "deposit", ok: true },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[0].ltv).toBe(7987);
    expect(rows[1].ok).toBe(true);
  });
});

describe("seriesForChart", () => {
  it("keeps only rows inside the window, oldest first", () => {
    const now = 1_000_000;
    const rows = [
      { ...post, ts: now - 90_000, tx: "old", effective_ltv: 0.7, sigma_annual: 0.8 },
      { ...post, ts: now - 3_600, tx: "mid", effective_ltv: 0.69, sigma_annual: 0.81 },
      { ...post, ts: now - 60, tx: "new", effective_ltv: 0.68, sigma_annual: 0.82 },
      { ...post, ts: now + 10, tx: "future", effective_ltv: 0.5, sigma_annual: 0.1 },
    ];
    const series = seriesForChart(rows, now, 86_400);
    expect(series.map((p) => p.tx)).toEqual(["mid", "new"]);
    expect(series[0].effectiveLtv).toBe(0.69);
    expect(series[1].sigmaAnnual).toBe(0.82);
  });
});

describe("borrowActions and labels", () => {
  it("lists only borrow and blocked rows, newest first", () => {
    const list = borrowActions([
      { ts: 1, kind: "deposit", owner: null, amount: 1, ltv: null, limit: null, ok: true, tx: "d", error: null },
      { ts: 2, kind: "blocked", owner: null, amount: null, ltv: 7987, limit: 6987, ok: false, tx: "b", error: "RiskTightened" },
      { ts: 3, kind: "borrow", owner: null, amount: 1, ltv: 4010, limit: 6987, ok: true, tx: "a", error: null },
    ]);
    expect(list.map((r) => r.tx)).toEqual(["a", "b"]);
  });

  it("formats accepted and rejected borrows without inventing numbers", () => {
    const blocked = formatBorrowAction({
      ts: 0,
      kind: "blocked",
      owner: null,
      amount: null,
      ltv: 7987,
      limit: 6987,
      ok: false,
      tx: "SigBlocked111",
      error: "RiskTightened",
    });
    expect(blocked.ok).toBe(false);
    expect(blocked.label).toBe("Rejected");
    expect(blocked.detail).toBe("79.9% LTV, limit 69.9%, RiskTightened");
    expect(blocked.href).toBe("https://explorer.solana.com/tx/SigBlocked111?cluster=devnet");

    const ok = formatBorrowAction({
      ts: 0,
      kind: "borrow",
      owner: null,
      amount: 1,
      ltv: 4010,
      limit: 6987,
      ok: true,
      tx: "SigOk111",
      error: null,
    });
    expect(ok.ok).toBe(true);
    expect(ok.label).toBe("Accepted");
    expect(ok.detail).toBe("40.1% LTV, limit 69.9%");
  });
});

describe("formatting and geometry", () => {
  it("renders percents and UTC times", () => {
    expect(pctFromBps(6987)).toBe("69.9%");
    expect(pctFromRatio(0.6939)).toBe("69.4%");
    expect(formatUtcTime(0)).toBe("00:00 UTC");
    expect(formatUtcDateTime(0)).toBe("Jan 1, 00:00 UTC");
  });

  it("builds an SVG line and hour ticks over a 24h window", () => {
    expect(linePath([])).toBe("");
    expect(linePath([{ x: 10, y: 20 }, { x: 30.44, y: 40.91 }])).toBe("M10.0,20.0L30.4,40.9");
    const t0 = 1_000_000;
    const t1 = t0 + 86_400;
    const ticks = timeTicks(t0, t1, 6);
    expect(ticks.length).toBeGreaterThanOrEqual(4);
    expect(ticks.length).toBeLessThanOrEqual(7);
    for (const t of ticks) expect(t % 3600).toBe(0);
    expect(ticks[0]).toBeGreaterThanOrEqual(t0);
    expect(ticks[ticks.length - 1]).toBeLessThanOrEqual(t1);
  });

  it("pads a domain without leaving [0, loft]", () => {
    const d = paddedDomain([0.69, 0.71], 1, [0.5, 0.8]);
    expect(d.min).toBeGreaterThanOrEqual(0);
    expect(d.max).toBeLessThanOrEqual(1);
    expect(d.max).toBeGreaterThan(d.min);
    const wide = paddedDomain([0.69, 0.70], 1, [0.5, 0.8], 0.1);
    expect(wide.max - wide.min).toBeGreaterThanOrEqual(0.1 - 1e-9);
    expect(wide.min).toBeLessThanOrEqual(0.69);
    expect(wide.max).toBeGreaterThanOrEqual(0.70);
    expect(paddedDomain([], 1, [0.5, 0.8])).toEqual({ min: 0.5, max: 0.8 });
  });
});
