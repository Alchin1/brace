import { describe, expect, test } from "vitest";
import { fetchEvents, fetchSpotE6, GEMINI_TIMEOUT_MS } from "../src/gemini.ts";
import { MAX_ROWS } from "../src/history.ts";
import worker from "../src/index.ts";
import type { Env } from "../src/index.ts";
import { rpcAwareFetch, RPC_TIMEOUT_MS } from "../src/rpc.ts";
import { MemoryStore, type PostRow } from "../src/store.ts";
import { ASSETS } from "../src/assets.ts";

function env(store: MemoryStore): Env {
  return { PROGRAM_ID: "Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC", STREAMS_SINK_SECRET: "s", __store: store };
}

function post(ts: number, asset = "SOL"): PostRow {
  return {
    ts,
    asset,
    spot_e6: 72_000_000,
    median_e6: 72_000_000,
    sigma_bps: 8000,
    horizon_secs: 86_400,
    k_x100: 300,
    max_ltv_bps: 7000,
    effective_ltv_bps: 7000,
    confident: 1,
    points: 8,
    expiry_ts: ts + 3600,
    ticker: `${asset}2611172200`,
    tx: `TX_${asset}_${ts}`,
  } as PostRow;
}

async function get(store: MemoryStore, path: string) {
  const res = await worker.fetch(new Request(`https://example.com${path}`), env(store));
  return { res, body: (await res.json()) as unknown };
}

describe("GET /history and /actions reject bad input with a clear 400", () => {
  test("unknown asset is 400 and names the valid assets", async () => {
    const { res, body } = await get(new MemoryStore(), "/history?asset=DOGE");
    expect(res.status).toBe(400);
    expect(res.headers.get("access-control-allow-origin")).toBe("*");
    expect((body as { error: string }).error).toContain("SOL, BTC, ETH, XRP, ZEC");
  });

  test("lowercase asset is accepted as the same asset", async () => {
    const store = new MemoryStore();
    store.posts.push(post(1000));
    const { res, body } = await get(store, "/history?asset=sol");
    expect(res.status).toBe(200);
    expect((body as unknown[]).length).toBe(1);
  });

  test.each(["abc", "-5", "1.5e400", "12abc"])("since=%s is 400", async (since) => {
    for (const path of [`/history?asset=SOL&since=${since}`, `/actions?since=${since}`]) {
      const { res, body } = await get(new MemoryStore(), path);
      expect(res.status, path).toBe(400);
      expect((body as { error: string }).error).toMatch(/since/);
    }
  });

  test("empty since is ignored, numeric since filters", async () => {
    const store = new MemoryStore();
    store.posts.push(post(1000), post(2000));
    expect(((await get(store, "/history?asset=SOL&since=")).body as unknown[]).length).toBe(2);
    expect(((await get(store, "/history?asset=SOL&since=1500")).body as unknown[]).length).toBe(1);
  });

  test.each(["0", "-1", "abc", String(MAX_ROWS + 1)])("limit=%s is 400", async (limit) => {
    const { res, body } = await get(new MemoryStore(), `/history?asset=SOL&limit=${limit}`);
    expect(res.status).toBe(400);
    expect((body as { error: string }).error).toMatch(/limit/);
  });
});

describe("GET /history stays bounded", () => {
  test("with no since, returns the newest rows (still oldest first), capped by limit", async () => {
    const store = new MemoryStore();
    for (let i = 1; i <= 10; i++) store.posts.push(post(i * 60));
    const { body } = await get(store, "/history?asset=SOL&limit=3");
    expect((body as { ts: number }[]).map((r) => r.ts)).toEqual([480, 540, 600]);
  });

  test("with since, returns the oldest rows from since so a client can page forward", async () => {
    const store = new MemoryStore();
    for (let i = 1; i <= 10; i++) store.posts.push(post(i * 60));
    const { body } = await get(store, "/history?asset=SOL&since=120&limit=3");
    expect((body as { ts: number }[]).map((r) => r.ts)).toEqual([120, 180, 240]);
  });

  test("default cap is MAX_ROWS", async () => {
    const store = new MemoryStore();
    for (let i = 0; i < MAX_ROWS + 5; i++) store.posts.push(post(i));
    const { body } = await get(store, "/history?asset=SOL");
    const rows = body as { ts: number }[];
    expect(rows.length).toBe(MAX_ROWS);
    expect(rows[rows.length - 1].ts).toBe(MAX_ROWS + 4);
  });

  test("/actions is capped too", async () => {
    const store = new MemoryStore();
    for (let i = 0; i < 5; i++)
      store.actions.push({ ts: i, kind: "borrow", owner: null, amount: 1, ltv: 1, limit: 1, ok: 1, tx: `T${i}`, error: null } as never);
    const { body } = await get(store, "/actions?limit=2");
    expect((body as { ts: number }[]).map((r) => r.ts)).toEqual([3, 4]);
  });
});

describe("GET /preview", () => {
  test("unknown asset is 400, not 200 with an error body", async () => {
    const { res, body } = await get(new MemoryStore(), "/preview?asset=DOGE");
    expect(res.status).toBe(400);
    expect((body as { error: string }).error).toContain("unknown asset");
  });
});

describe("third-party calls carry a timeout", () => {
  test("Gemini events and pubticker fetches pass an abort signal", async () => {
    const seen: (AbortSignal | undefined)[] = [];
    const fake = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      seen.push(init?.signal ?? undefined);
      if (String(_u).includes("pubticker")) return Response.json({ last: "72.5" });
      return Response.json({ data: [] });
    }) as typeof fetch;
    await fetchEvents(fake);
    await fetchSpotE6(ASSETS[0], fake);
    expect(seen).toHaveLength(2);
    for (const s of seen) expect(s).toBeInstanceOf(AbortSignal);
    expect(GEMINI_TIMEOUT_MS).toBeGreaterThan(0);
    expect(GEMINI_TIMEOUT_MS).toBeLessThanOrEqual(10_000);
  });

  test("a hung Gemini call fails with a timeout instead of hanging", async () => {
    const hung = ((_u: RequestInfo | URL, init?: RequestInit) =>
      new Promise<Response>((_res, rej) => {
        init?.signal?.addEventListener("abort", () => rej(init.signal?.reason ?? new Error("aborted")));
      })) as typeof fetch;
    const t0 = Date.now();
    await expect(fetchEvents(hung, 50)).rejects.toThrow(/timeout|abort/i);
    expect(Date.now() - t0).toBeLessThan(2_000);
  });

  test("RPC fetch adds an abort signal when the caller has none", async () => {
    let seen: AbortSignal | undefined;
    const base = (async (_u: RequestInfo | URL, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return Response.json({ ok: true });
    }) as typeof fetch;
    await rpcAwareFetch(base)("https://rpc.example", { method: "POST" });
    expect(seen).toBeInstanceOf(AbortSignal);
    expect(RPC_TIMEOUT_MS).toBeGreaterThan(0);
  });
});
