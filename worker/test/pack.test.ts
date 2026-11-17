import { Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import type { Quote } from "../src/encode.ts";
import {
  MAX_TX_CU,
  PACKET_DATA_SIZE,
  POST_CU_BUDGET,
  PACK_CU_OVERHEAD,
  packPostBatches,
  packedCuLimit,
  signedTxSize,
  type PackedPost,
} from "../src/tx.ts";

const PROGRAM_ID = new PublicKey("Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC");
const BLOCKHASH = "11111111111111111111111111111111";
const SYMBOLS = ["SOL", "BTC", "ETH", "XRP", "ZEC"] as const;

function quotes(n: number): Quote[] {
  return Array.from({ length: n }, (_, i) => ({
    strikeE6: 70_000_000n + BigInt(i) * 1_000_000n,
    bidBps: 4000 + i,
    askBps: 5000 + i,
  }));
}

function post(symbol: string, nQuotes: number): PackedPost {
  return {
    symbol,
    expiryTs: 1_794_952_800,
    ticker: `${symbol}2611172200`,
    spotE6: 70_000_000n,
    quotes: quotes(nQuotes),
  };
}

function pack(posts: PackedPost[]) {
  return packPostBatches({
    programId: PROGRAM_ID,
    relayer: Keypair.generate(),
    recentBlockhash: BLOCKHASH,
    posts,
  });
}

describe("packed post_quotes size and CU", () => {
  test("packed CU budget is n * 80k + 10k and stays under the 1.4M cap for all 5 assets", () => {
    expect(packedCuLimit(1)).toBe(POST_CU_BUDGET + PACK_CU_OVERHEAD);
    expect(packedCuLimit(5)).toBe(5 * POST_CU_BUDGET + PACK_CU_OVERHEAD);
    expect(packedCuLimit(5)).toBe(410_000);
    expect(packedCuLimit(5)).toBeLessThanOrEqual(MAX_TX_CU);
    // Even a pessimistic 90k/post * 5 is far under 1.4M; size is the limiter.
    expect(5 * 90_000).toBeLessThan(MAX_TX_CU);
  });

  test("a single post fits the 1232-byte packet at 2 through 16 quotes", () => {
    const sizes: Record<number, number> = {};
    for (const n of [2, 4, 6, 8, 10, 12, 16]) {
      const batches = pack([post("SOL", n)]);
      expect(batches).toHaveLength(1);
      expect(batches[0].size).toBeLessThanOrEqual(PACKET_DATA_SIZE);
      expect(batches[0].cuLimit).toBeLessThanOrEqual(MAX_TX_CU);
      expect(signedTxSize(batches[0].tx)).toBe(batches[0].size);
      sizes[n] = batches[0].size;
    }
    // Recorded so a later quote-count change cannot silently exceed the packet.
    expect(sizes[2]).toBeLessThan(sizes[16]);
    expect(sizes[16]).toBeGreaterThan(0);
  });

  test("packs as many 16-quote posts as the 1232-byte limit allows, never exceeding it", () => {
    const posts = SYMBOLS.map((s) => post(s, 16));
    const batches = pack(posts);
    const posted = batches.reduce((n, b) => n + b.posts.length, 0);
    expect(posted).toBe(5);
    expect(batches.length).toBeGreaterThanOrEqual(1);
    expect(batches.length).toBeLessThanOrEqual(5);
    for (const b of batches) {
      expect(b.size).toBeLessThanOrEqual(PACKET_DATA_SIZE);
      expect(b.cuLimit).toBeLessThanOrEqual(MAX_TX_CU);
      expect(b.cuLimit).toBe(packedCuLimit(b.posts.length));
    }
    // Two or more posts must share a transaction when they fit; CU is not the limiter.
    expect(batches.map((b) => ({ n: b.posts.length, size: b.size, cu: b.cuLimit }))).toEqual([
      { n: 3, size: 1182, cu: 250_000 },
      { n: 2, size: 882, cu: 170_000 },
    ]);
  });

  test("packs typical fixture quote counts into as few transactions as size allows", () => {
    // Quote counts from the 2026-11-17 Gemini fixture used in select.test.ts.
    const counts: Record<string, number> = { SOL: 8, BTC: 9, ETH: 7, XRP: 8, ZEC: 6 };
    const posts = SYMBOLS.map((s) => post(s, counts[s]));
    const batches = pack(posts);
    const posted = batches.reduce((n, b) => n + b.posts.length, 0);
    expect(posted).toBe(5);
    for (const b of batches) {
      expect(b.size).toBeLessThanOrEqual(PACKET_DATA_SIZE);
      expect(b.cuLimit).toBeLessThanOrEqual(MAX_TX_CU);
    }
    expect(batches.map((b) => ({ n: b.posts.length, size: b.size, cu: b.cuLimit }))).toEqual([
      { n: 4, size: 1098, cu: 330_000 },
      { n: 1, size: 462, cu: 90_000 },
    ]);
  });
});
