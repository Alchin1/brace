// Runs the real D1Store SQL against SQLite (node:sqlite) with schema.sql, so the
// production queries behind /history and /actions are exercised, not only MemoryStore.
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import { actionsResponse, historyResponse } from "../src/history.ts";
import { D1Store, type ActionRow, type PostRow } from "../src/store.ts";

const root = dirname(fileURLToPath(import.meta.url));

function fakeD1(): D1Database {
  const db = new DatabaseSync(":memory:");
  db.exec(readFileSync(join(root, "../schema.sql"), "utf8"));
  const stmt = (sql: string, params: unknown[] = []) => ({
    bind: (...p: unknown[]) => stmt(sql, p),
    all: async () => ({ results: db.prepare(sql).all(...(params as never[])) }),
    run: async () => {
      db.prepare(sql).run(...(params as never[]));
      return { success: true };
    },
    first: async () => db.prepare(sql).get(...(params as never[])) ?? null,
  });
  return {
    prepare: (sql: string) => stmt(sql),
    batch: async (stmts: { run: () => Promise<unknown> }[]) => Promise.all(stmts.map((s) => s.run())),
  } as unknown as D1Database;
}

function post(ts: number, asset: string): PostRow {
  return {
    ts, asset, spot_e6: 1, median_e6: 1, sigma_bps: 8000, horizon_secs: 86_400, k_x100: 300,
    max_ltv_bps: 7000, effective_ltv_bps: 7000, confident: 1, points: 8, expiry_ts: ts + 60,
    ticker: `${asset}X`, tx: `T${ts}`,
  } as PostRow;
}

describe("D1Store SQL (SQLite) for bounded /history and /actions", () => {
  test("posts: newest N without since, first N from since, asset filter, oldest first", async () => {
    const store = new D1Store(fakeD1());
    for (let i = 1; i <= 6; i++) {
      await store.upsertPost(post(i * 60, "SOL"));
      await store.upsertPost(post(i * 60, "BTC"));
    }
    const newest = await historyResponse(store, "SOL", undefined, 2);
    expect(newest.map((r) => r.ts)).toEqual([300, 360]);
    const paged = await historyResponse(store, "SOL", 120, 2);
    expect(paged.map((r) => r.ts)).toEqual([120, 180]);
    const all = await historyResponse(store, undefined, undefined);
    expect(all).toHaveLength(12);
    expect(all.map((r) => r.ts)).toEqual([...all.map((r) => r.ts)].sort((a, b) => a - b));
  });

  test("actions: newest N without since, first N from since", async () => {
    const store = new D1Store(fakeD1());
    for (let i = 1; i <= 4; i++) {
      await store.upsertAction({ ts: i, kind: "borrow", owner: "o", amount: 1, ltv: 1, limit: 2, ok: 1, tx: `A${i}`, error: null } as ActionRow);
    }
    expect((await actionsResponse(store, undefined, 2)).map((r) => r.ts)).toEqual([3, 4]);
    expect((await actionsResponse(store, 2, 2)).map((r) => r.ts)).toEqual([2, 3]);
    expect((await actionsResponse(store, undefined))[0].limit).toBe(2);
  });
});

describe("D1Store SQL that keeps D1 rows read and written low", () => {
  test("latestPostTsByAsset returns MAX(ts) per asset and skips assets with no posts", async () => {
    const store = new D1Store(fakeD1());
    for (const [ts, asset] of [[100, "SOL"], [300, "SOL"], [200, "BTC"], [250, "ZEC"]] as const) {
      await store.upsertPost(post(ts, asset));
    }
    expect(await store.latestPostTsByAsset()).toEqual({ SOL: 300, BTC: 200, ZEC: 250 });
  });

  test("saveRelayerRun writes the run row and only asset rows that changed, in one batch", async () => {
    const db = fakeD1();
    const batches: number[] = [];
    const orig = db.batch.bind(db);
    (db as { batch: unknown }).batch = async (stmts: unknown[]) => {
      batches.push(stmts.length);
      return orig(stmts as never);
    };
    const store = new D1Store(db);
    const first = {
      lastRun: "2026-11-18T06:00:00.000Z",
      lastError: null,
      assets: [
        { asset: "BTC", lastSig: "B1", lastAt: 1, lastError: null },
        { asset: "SOL", lastSig: "S1", lastAt: 1, lastError: null },
      ],
    };
    await store.saveRelayerRun(first);
    const prev = await store.loadRelayerRun();
    expect(prev).toEqual(first);
    const next = { ...first, lastRun: "2026-11-18T06:01:00.000Z", assets: [{ ...first.assets[0], lastSig: "B2", lastAt: 61 }, first.assets[1]] };
    await store.saveRelayerRun(next, prev);
    expect(batches).toEqual([3, 2]);
    expect(await store.loadRelayerRun()).toEqual(next);
  });
});

