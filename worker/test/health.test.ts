import { describe, expect, test } from "vitest";
import { healthReport, persistRun } from "../src/index.ts";
import { buildHealthReport, MemoryStore } from "../src/store.ts";
import type { Env } from "../src/index.ts";
import worker from "../src/index.ts";

describe("D1-backed /health", () => {
  test("buildHealthReport uses Stream post timestamps for feed age and keeps last signatures", () => {
    const report = buildHealthReport(
      {
        lastRun: "2026-11-17T04:00:00.000Z",
        lastError: "ZEC: rpc http 429",
        assets: [
          { asset: "SOL", lastSig: "SigSol", lastAt: 1000, lastError: null },
          { asset: "ZEC", lastSig: "SigZec", lastAt: 900, lastError: "rpc http 429" },
        ],
      },
      { SOL: 1060, BTC: 1050 },
      1100,
    );
    expect(report.ok).toBe(true);
    expect(report.lastRun).toBe("2026-11-17T04:00:00.000Z");
    expect(report.lastError).toBe("ZEC: rpc http 429");
    expect(report.lastSigs).toEqual({ SOL: "SigSol", ZEC: "SigZec" });
    expect(report.feeds.SOL).toEqual({ lastSig: "SigSol", lastPostTs: 1060, ageSecs: 40, lastError: null });
    expect(report.feeds.BTC).toEqual({ lastSig: null, lastPostTs: 1050, ageSecs: 50, lastError: null });
    expect(report.feeds.ZEC).toEqual({ lastSig: "SigZec", lastPostTs: 900, ageSecs: 200, lastError: "rpc http 429" });
  });

  test("persistRun merges new signatures and errors, then /health reads them from the store", async () => {
    const store = new MemoryStore();
    await persistRun(
      store,
      [
        { asset: "SOL", ticker: "SOL2611172200", sig: "Sig1" },
        { asset: "BTC", error: "rpc http 429" },
      ],
      1_794_888_000,
      null,
    );
    await persistRun(
      store,
      [{ asset: "BTC", ticker: "BTC2611172200", sig: "Sig2" }],
      1_794_888_060,
      null,
    );
    const env: Env = {
      PROGRAM_ID: "Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC",
      __store: store,
    };
    const res = await worker.fetch(new Request("https://example.com/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Awaited<ReturnType<typeof healthReport>>;
    expect(body.lastRun).toBe("2026-11-17T04:01:00.000Z");
    expect(body.lastError).toBeNull();
    expect(body.lastSigs).toEqual({ SOL: "Sig1", BTC: "Sig2" });
    expect(body.feeds.SOL?.lastSig).toBe("Sig1");
    expect(body.feeds.BTC?.lastSig).toBe("Sig2");
    expect(body.feeds.BTC?.lastError).toBeNull();
  });
});
