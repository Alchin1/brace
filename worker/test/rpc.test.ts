import { describe, expect, test } from "vitest";
import {
  isRetryableRpcError,
  parseRpcUrls,
  retryAfterMs,
  retryWithBackoff,
  rpcAwareFetch,
  rotateUrls,
  withRpcFallback,
} from "../src/rpc.ts";

describe("parseRpcUrls", () => {
  test("splits a comma-separated RPC_URLS list, trims, and de-duplicates in order", () => {
    expect(
      parseRpcUrls({
        RPC_URL: "https://ignored.example/rpc",
        RPC_URLS:
          "https://solana-devnet.api.onfinality.io/public, https://example.com/rpc ,https://solana-devnet.api.onfinality.io/public",
      }),
    ).toEqual(["https://solana-devnet.api.onfinality.io/public", "https://example.com/rpc"]);
  });

  test("falls back to RPC_URL, then the known-good onfinality default", () => {
    expect(parseRpcUrls({ RPC_URL: "https://only.example/rpc" })).toEqual(["https://only.example/rpc"]);
    expect(parseRpcUrls({})).toEqual(["https://solana-devnet.api.onfinality.io/public"]);
  });
});

describe("retry and fallback", () => {
  test("retries retryable errors with exponential backoff", async () => {
    const sleeps: number[] = [];
    let n = 0;
    const value = await retryWithBackoff(
      async () => {
        n++;
        if (n < 3) {
          const err = new Error("rpc http 429") as Error & { status: number };
          err.status = 429;
          throw err;
        }
        return "ok";
      },
      { retries: 3, sleep: async (ms) => { sleeps.push(ms); } },
    );
    expect(value).toBe("ok");
    expect(n).toBe(3);
    expect(sleeps).toEqual([200, 400]);
  });

  test("does not retry a non-429 program error", async () => {
    let n = 0;
    await expect(
      retryWithBackoff(
        async () => {
          n++;
          throw new Error("Simulation failed: custom program error: 0x1775");
        },
        { retries: 3, sleep: async () => {} },
      ),
    ).rejects.toThrow(/0x1775/);
    expect(n).toBe(1);
  });

  test("honors Retry-After milliseconds attached to the error", () => {
    const err = new Error("rpc http 429") as Error & { status: number; retryAfterMs: number };
    err.status = 429;
    err.retryAfterMs = 1500;
    expect(retryAfterMs(err, 0)).toBe(1500);
    expect(isRetryableRpcError(err)).toBe(true);
  });

  test("falls through to the next URL after retries are exhausted", async () => {
    const tried: string[] = [];
    const { result, url } = await withRpcFallback(
      ["https://a.example", "https://b.example"],
      async (u) => {
        tried.push(u);
        if (u.endsWith("a.example")) {
          const err = new Error("rpc http 429") as Error & { status: number };
          err.status = 429;
          throw err;
        }
        return "from-b";
      },
      { retries: 1, sleep: async () => {} },
    );
    expect(result).toBe("from-b");
    expect(url).toBe("https://b.example");
    expect(tried).toEqual(["https://a.example", "https://a.example", "https://b.example"]);
  });

  test("rpcAwareFetch throws a retryable error on HTTP 429", async () => {
    const inner = (async () => new Response("slow down", { status: 429, headers: { "retry-after": "2" } })) as typeof fetch;
    const wrapped = rpcAwareFetch(inner);
    try {
      await wrapped("https://example.com");
      throw new Error("expected throw");
    } catch (err) {
      expect(isRetryableRpcError(err)).toBe(true);
      expect((err as { status: number }).status).toBe(429);
      expect((err as { retryAfterMs: number }).retryAfterMs).toBe(2000);
    }
  });
});


describe("rotateUrls", () => {
  const urls = [
    "https://solana-devnet.api.onfinality.io/public",
    "https://solana-devnet.gateway.tatum.io",
  ];

  test("rotates so offset becomes first and wraps", () => {
    expect(rotateUrls(urls, 0)).toEqual(urls);
    expect(rotateUrls(urls, 1)).toEqual([urls[1], urls[0]]);
    expect(rotateUrls(urls, 2)).toEqual(urls);
    expect(rotateUrls(urls, 5)).toEqual([urls[1], urls[0]]);
  });

  test("treats a negative offset modulo the length and leaves short lists alone", () => {
    expect(rotateUrls(urls, -1)).toEqual([urls[1], urls[0]]);
    expect(rotateUrls(["https://only.example"], 9)).toEqual(["https://only.example"]);
    expect(rotateUrls([], 3)).toEqual([]);
  });
});
