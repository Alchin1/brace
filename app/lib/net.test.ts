import { afterEach, describe, expect, test, vi } from "vitest";
import { fetchWithTimeout, friendlyNetError, RELAYER_TIMEOUT_MS, RPC_TIMEOUT_MS, timeoutFetch } from "./net";
import { fetchBoard } from "./brace";

afterEach(() => vi.unstubAllGlobals());

describe("browser fetch timeouts", () => {
  test("timeouts are set and short enough for a phone", () => {
    expect(RPC_TIMEOUT_MS).toBeGreaterThan(0);
    expect(RPC_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
    expect(RELAYER_TIMEOUT_MS).toBeGreaterThan(0);
    expect(RELAYER_TIMEOUT_MS).toBeLessThanOrEqual(15_000);
  });

  test("fetchWithTimeout aborts a request that never answers", async () => {
    vi.stubGlobal("fetch", (_u: unknown, init?: RequestInit) =>
      new Promise((_res, rej) => init?.signal?.addEventListener("abort", () => rej(init.signal?.reason))),
    );
    const t0 = Date.now();
    await expect(fetchWithTimeout("https://x.example", {}, 50)).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(2_000);
  });

  test("fetchWithTimeout keeps a caller's own signal working", async () => {
    let seen: AbortSignal | undefined;
    vi.stubGlobal("fetch", async (_u: unknown, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response("ok");
    });
    const ctrl = new AbortController();
    await fetchWithTimeout("https://x.example", { signal: ctrl.signal }, 1000);
    expect(seen).toBeInstanceOf(AbortSignal);
    ctrl.abort();
    expect(seen?.aborted).toBe(true);
  });

  test("timeoutFetch passes an abort signal for web3.js", async () => {
    let seen: AbortSignal | undefined;
    vi.stubGlobal("fetch", async (_u: unknown, init?: RequestInit) => {
      seen = init?.signal ?? undefined;
      return new Response("{}");
    });
    await timeoutFetch(1000)("https://rpc.example", { method: "POST" });
    expect(seen).toBeInstanceOf(AbortSignal);
  });
});

describe("plain error messages", () => {
  test("timeout", () => {
    const e = new DOMException("signal timed out", "TimeoutError");
    expect(friendlyNetError(e, "Solana devnet")).toBe("Solana devnet did not answer in time.");
  });
  test("network failure", () => {
    expect(friendlyNetError(new TypeError("Failed to fetch"), "Solana devnet")).toBe("Could not connect to Solana devnet.");
  });
  test("rate limit", () => {
    expect(friendlyNetError(new Error("429 Too Many Requests"), "Solana devnet")).toBe("Solana devnet is busy right now.");
  });
  test("anything else never shows raw text", () => {
    const m = friendlyNetError(new Error("weird internal thing xyz"), "the history service");
    expect(m).toBe("Something went wrong talking to the history service.");
    expect(m).not.toMatch(/xyz|Error:/);
  });
});

describe("fetchBoard", () => {
  test("RPC down gives a plain error, not 'Failed to fetch'", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new TypeError("Failed to fetch");
    });
    const s = await fetchBoard("https://rpc.example");
    expect(s.kind).toBe("error");
    if (s.kind === "error") {
      expect(s.message).toBe("Could not connect to Solana devnet.");
    }
  });
});
