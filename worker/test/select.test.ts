import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { ASSETS } from "../src/assets.ts";
import { decimalToScaled } from "../src/encode.ts";
import { selectLadder } from "../src/select.ts";
import type { GeminiEvent } from "../src/gemini.ts";

const root = dirname(fileURLToPath(import.meta.url));
const fixture = JSON.parse(readFileSync(join(root, "fixtures/events-2026-11-17.json"), "utf8")) as {
  capturedAt: string;
  frozenNowTs: number;
  data: GeminiEvent[];
};

const NOW = fixture.frozenNowTs; // 2026-11-17T03:12:00Z, when these responses were fetched

function asset(symbol: string) {
  const a = ASSETS.find((x) => x.symbol === symbol);
  if (!a) throw new Error(symbol);
  return a;
}

describe("ladder selection on the live 2026-11-17 Gemini snapshot", () => {
  test("ignores 5- and 15-minute up/down markets", () => {
    const updown = fixture.data.filter((e) => /05M|15M/.test(e.ticker ?? ""));
    expect(updown.length).toBeGreaterThan(0);
    expect(updown.every((e) => !(e.ticker ?? "").startsWith("SOL2"))).toBe(true);
    const sol = selectLadder(updown, asset("SOL"), NOW);
    expect(sol).toBeNull();
  });

  test("prefers the earliest expiry that has at least 4 tight above-contracts", () => {
    // Hourly SOL/ETH/XRP/ZEC books were too thin at capture time; daily ladders were used.
    // BTC hourly (04:00Z) had 9 tight quotes, so it wins over the later daily.
    const expected: Record<string, { ticker: string; tight: number; firstStrike: bigint }> = {
      SOL: { ticker: "SOL2611172200", tight: 8, firstStrike: 72_000_000n },
      BTC: { ticker: "BTC2611170400", tight: 9, firstStrike: 64_600_000_000n },
      ETH: { ticker: "ETH2611172200", tight: 7, firstStrike: 1_800_000_000n },
      XRP: { ticker: "XRP2611172200", tight: 8, firstStrike: 960_000n },
      ZEC: { ticker: "ZEC2611172200", tight: 6, firstStrike: 900_000_000n },
    };
    for (const [symbol, want] of Object.entries(expected)) {
      const got = selectLadder(fixture.data, asset(symbol), NOW);
      expect(got, symbol).not.toBeNull();
      expect(got!.ticker).toBe(want.ticker);
      expect(got!.tightCount).toBe(want.tight);
      expect(got!.quotes.length).toBe(want.tight);
      expect(got!.quotes[0].strikeE6).toBe(want.firstStrike);
      expect(got!.expiryTs - NOW).toBeGreaterThanOrEqual(900);
      expect(got!.expiryTs - NOW).toBeLessThanOrEqual(259_200);
    }
  });

  test("skips expiries outside 15 minutes to 72 hours", () => {
    // Nov 20 22:00Z is ~90h after the frozen now, so it must not be chosen.
    const sol = selectLadder(fixture.data, asset("SOL"), NOW);
    expect(sol?.ticker).toBe("SOL2611172200");
    expect(fixture.data.some((e) => e.ticker === "SOL2611202200")).toBe(true);
  });

  test("orders quotes closest to a 50% mid first", () => {
    const sol = selectLadder(fixture.data, asset("SOL"), NOW)!;
    const mids = sol.quotes.map((q) => Number((BigInt(q.bidBps) + BigInt(q.askBps)) / 2n));
    const distances = mids.map((m) => Math.abs(m - 5000));
    expect(distances).toEqual([...distances].sort((a, b) => a - b));
    expect(sol.quotes[0]).toEqual({ strikeE6: 72_000_000n, bidBps: 4600, askBps: 5300 });
  });

  test("drops contracts with a missing bid or ask or a wide spread", () => {
    // SOL hourly 04:00Z exists but had only 1 tight quote at capture (many asks without bids).
    const hourly = fixture.data.find((e) => e.ticker === "SOL2611170400")!;
    const missing = (hourly.contracts ?? []).filter((c) => !c.prices?.bestBid || !c.prices?.bestAsk);
    expect(missing.length).toBeGreaterThan(0);
    const sol = selectLadder(fixture.data, asset("SOL"), NOW)!;
    expect(sol.ticker).not.toBe("SOL2611170400");
  });

  test("an asset with no valid ladder is skipped (returns null, does not throw)", () => {
    const onlyUpDown = fixture.data.filter((e) => /05M|15M/.test(e.ticker ?? ""));
    expect(() => selectLadder(onlyUpDown, asset("SOL"), NOW)).not.toThrow();
    expect(selectLadder(onlyUpDown, asset("SOL"), NOW)).toBeNull();
  });

  test("live pubticker last values parse with integer math", () => {
    const spots: Record<string, string> = {
      solusd: "72.17900",
      btcusd: "64602.60000",
      ethusd: "1818.59000",
      xrpusd: "0.9589700",
      zecusd: "910.26000",
    };
    const expected: Record<string, bigint> = {
      solusd: 72_179_000n,
      btcusd: 64_602_600_000n,
      ethusd: 1_818_590_000n,
      xrpusd: 958_970n,
      zecusd: 910_260_000n,
    };
    for (const [sym, last] of Object.entries(spots)) {
      const file = JSON.parse(readFileSync(join(root, "fixtures", `${sym}.json`), "utf8")) as { last: string };
      expect(file.last).toBe(last);
      expect(decimalToScaled(file.last, 6)).toBe(expected[sym]);
    }
  });
});

describe("preview encoding of a live selected ladder", () => {
  test("previewAsset returns the SOL daily ladder and IDL-valid instruction data", async () => {
    const { previewAsset } = await import("../src/index.ts");
    const events = fixture.data;
    const fetchFn = (async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("prediction-markets/events")) {
        return new Response(JSON.stringify({ data: events }), { headers: { "content-type": "application/json" } });
      }
      if (url.includes("pubticker/solusd")) {
        const tick = readFileSync(join(root, "fixtures/solusd.json"), "utf8");
        return new Response(tick, { headers: { "content-type": "application/json" } });
      }
      return new Response("missing", { status: 404 });
    }) as typeof fetch;
    const body = await previewAsset("SOL", NOW, fetchFn);
    expect(body.ticker).toBe("SOL2611172200");
    expect(body.spotE6).toBe("72179000");
    expect(body.quotes).toHaveLength(8);
    expect(typeof body.dataHex).toBe("string");
    expect((body.dataHex as string).startsWith("4a1b2d26bcddc2ef")).toBe(true);
    expect((body.dataHex as string).length).toBe((8 + 8 + 8 + 32 + 8 + 4 + 8 * 12) * 2);
  });
});
