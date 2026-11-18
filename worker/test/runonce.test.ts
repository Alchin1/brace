import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { Keypair } from "@solana/web3.js";
import bs58 from "bs58";
import { describe, expect, test } from "vitest";
import { PENDING_EXPIRE_SECS } from "../src/confirm.ts";
import { persistRun, resetMemoryState, runOnce } from "../src/index.ts";
import { MemoryStore } from "../src/store.ts";
import type { Env } from "../src/index.ts";

const root = dirname(fileURLToPath(import.meta.url));
const eventsFixture = JSON.parse(
  readFileSync(join(root, "fixtures/events-2026-11-17.json"), "utf8"),
) as { frozenNowTs: number; data: unknown[] };

const NOW = eventsFixture.frozenNowTs;
const ONF = "https://solana-devnet.api.onfinality.io/public";
const TAT = "https://solana-devnet.gateway.tatum.io";
const PROGRAM_ID = "Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC";
const BLOCKHASH = "11111111111111111111111111111111";

const PUBTICKERS: Record<string, string> = {
  solusd: readFileSync(join(root, "fixtures/solusd.json"), "utf8"),
  btcusd: readFileSync(join(root, "fixtures/btcusd.json"), "utf8"),
  ethusd: readFileSync(join(root, "fixtures/ethusd.json"), "utf8"),
  xrpusd: readFileSync(join(root, "fixtures/xrpusd.json"), "utf8"),
  zecusd: readFileSync(join(root, "fixtures/zecusd.json"), "utf8"),
};

type RpcCall = { url: string; method: string; params: unknown };

function jsonRpc(id: unknown, result: unknown): Response {
  return new Response(JSON.stringify({ jsonrpc: "2.0", id, result }), {
    status: 200,
    headers: { "content-type": "application/json" },
  });
}

function requestUrl(input: RequestInfo | URL): string {
  if (typeof input === "string") return input;
  if (input instanceof URL) return input.toString();
  if (typeof Request !== "undefined" && input instanceof Request) return input.url;
  return String(input);
}

function requestBody(input: RequestInfo | URL, init?: RequestInit): string {
  if (init?.body) return typeof init.body === "string" ? init.body : String(init.body);
  if (typeof Request !== "undefined" && input instanceof Request) return "";
  return "";
}

function makeEnv(store: MemoryStore): Env {
  const relayer = Keypair.generate();
  return {
    PROGRAM_ID,
    RELAYER_SECRET: bs58.encode(relayer.secretKey),
    RPC_URLS: `${ONF},${TAT}`,
    __store: store,
  };
}

function makeFetch(opts?: {
  onSend?: (url: string, params: unknown, call: RpcCall) => Response | null;
  onStatuses?: (sigs: string[]) => unknown;
  rpcCalls: RpcCall[];
}): typeof fetch {
  let sendN = 0;
  return (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = requestUrl(input);
    if (url.startsWith("https://api.gemini.com/v1/prediction-markets/events")) {
      return new Response(JSON.stringify({ data: eventsFixture.data }), { status: 200 });
    }
    const pub = /\/pubticker\/([a-z0-9]+)$/.exec(url);
    if (pub) {
      const body = PUBTICKERS[pub[1]];
      if (!body) return new Response("missing fixture", { status: 404 });
      return new Response(body, { status: 200, headers: { "content-type": "application/json" } });
    }

    let raw = requestBody(input, init);
    if (!raw && typeof Request !== "undefined" && input instanceof Request) {
      raw = await input.clone().text();
    }
    const body = raw ? (JSON.parse(raw) as { id?: unknown; method?: string; params?: unknown }) : {};
    const call: RpcCall = { url, method: body.method ?? "", params: body.params };
    opts?.rpcCalls.push(call);

    if (body.method === "getLatestBlockhash") {
      return jsonRpc(body.id, {
        context: { slot: 1 },
        value: { blockhash: BLOCKHASH, lastValidBlockHeight: 9_999_999 },
      });
    }
    if (body.method === "sendTransaction") {
      const override = opts?.onSend?.(url, body.params, call);
      if (override) return override;
      sendN += 1;
      return jsonRpc(body.id, "Sig" + String(sendN).padStart(3, "0") + "MockSubmittedTransactionSignature111111111111");
    }
    if (body.method === "getSignatureStatuses") {
      const sigs = (body.params as [string[], unknown] | undefined)?.[0] ?? [];
      const value = opts?.onStatuses
        ? opts.onStatuses(sigs)
        : sigs.map(() => ({
            slot: 1,
            confirmations: 1,
            err: null,
            confirmationStatus: "confirmed",
          }));
      return jsonRpc(body.id, { context: { slot: 1 }, value });
    }
    return new Response(JSON.stringify({ jsonrpc: "2.0", id: body.id, error: { message: `unexpected ${body.method}` } }), {
      status: 200,
    });
  }) as typeof fetch;
}

describe("runOnce RPC minimization", () => {
  test("uses one getLatestBlockhash, skipPreflight sends, packs posts, and records pending sigs", async () => {
    const store = new MemoryStore();
    const rpcCalls: RpcCall[] = [];
    const results = await runOnce(makeEnv(store), NOW, makeFetch({ rpcCalls }));

    const posted = results.filter((r) => r.sig);
    expect(posted.length).toBe(5);
    expect(results.filter((r) => r.error)).toEqual([]);
    const sigs = new Set(posted.map((r) => r.sig));
    expect(sigs.size).toBeGreaterThanOrEqual(1);
    expect(sigs.size).toBeLessThan(5); // packing must cut the number of sends

    const methods = rpcCalls.map((c) => c.method);
    expect(methods.filter((m) => m === "getLatestBlockhash")).toHaveLength(1);
    expect(methods.filter((m) => m === "getSignatureStatuses")).toHaveLength(0);
    expect(methods.filter((m) => m === "sendTransaction").length).toBe(sigs.size);
    expect(methods.filter((m) => m === "sendTransaction").length).toBeLessThan(5);

    for (const call of rpcCalls.filter((c) => c.method === "sendTransaction")) {
      const params = call.params as [string, { skipPreflight?: boolean; maxRetries?: number }];
      expect(params[1].skipPreflight).toBe(true);
      expect(params[1].maxRetries).toBe(0);
    }

    const pending = await store.listPendingSigs();
    expect(pending.map((p) => p.asset).sort()).toEqual(posted.map((r) => r.asset).sort());
    expect(pending.every((p) => p.submittedAt === NOW)).toBe(true);
    // Even tick: rotation offset is frozenNowTs % 2.
    const firstHash = rpcCalls.find((c) => c.method === "getLatestBlockhash");
    expect(firstHash?.url.startsWith(NOW % 2 === 0 ? ONF : TAT)).toBe(true);
  });

  test("confirms pending sigs with a single getSignatureStatuses and skips still-pending assets", async () => {
    const store = new MemoryStore();
    await store.addPendingSigs([
      { sig: "PendingSolSig", asset: "SOL", submittedAt: NOW - 30 },
      { sig: "PendingBtcSig", asset: "BTC", submittedAt: NOW - 30 },
    ]);
    const rpcCalls: RpcCall[] = [];
    const results = await runOnce(
      makeEnv(store),
      NOW,
      makeFetch({
        rpcCalls,
        onStatuses: (sigs) =>
          sigs.map((sig) =>
            sig === "PendingSolSig"
              ? { slot: 1, confirmations: 1, err: null, confirmationStatus: "finalized" }
              : null,
          ),
      }),
    );

    const statusCalls = rpcCalls.filter((c) => c.method === "getSignatureStatuses");
    expect(statusCalls).toHaveLength(1);
    const requested = (statusCalls[0].params as [string[], unknown])[0].slice().sort();
    expect(requested).toEqual(["PendingBtcSig", "PendingSolSig"]);

    expect(results.find((r) => r.asset === "SOL" && r.sig)).toBeTruthy(); // confirmed last tick, posted this tick
    expect(results.find((r) => r.asset === "BTC" && r.skipped === "pending confirmation")).toBeTruthy();
    expect(results.filter((r) => r.sig).map((r) => r.asset).sort()).toEqual(["ETH", "SOL", "XRP", "ZEC"]);

    const pending = await store.listPendingSigs();
    expect(pending.some((p) => p.asset === "BTC" && p.sig === "PendingBtcSig")).toBe(true);
    expect(pending.some((p) => p.sig === "PendingSolSig")).toBe(false);
  });

  test("expires a dropped sig, then posts that asset again", async () => {
    const store = new MemoryStore();
    await store.addPendingSigs([{ sig: "DroppedZec", asset: "ZEC", submittedAt: NOW - PENDING_EXPIRE_SECS }]);
    const rpcCalls: RpcCall[] = [];
    const results = await runOnce(
      makeEnv(store),
      NOW,
      makeFetch({
        rpcCalls,
        onStatuses: () => [null],
      }),
    );
    expect(rpcCalls.filter((c) => c.method === "getSignatureStatuses")).toHaveLength(1);
    expect(results.find((r) => r.asset === "ZEC" && r.error === "confirm: signature expired or dropped")).toBeTruthy();
    expect(results.find((r) => r.asset === "ZEC" && r.sig)).toBeTruthy();
    const pending = await store.listPendingSigs();
    expect(pending.some((p) => p.sig === "DroppedZec")).toBe(false);
    expect(pending.some((p) => p.asset === "ZEC" && p.submittedAt === NOW)).toBe(true);

    await persistRun(store, results, NOW, null);
    const run = await store.loadRelayerRun();
    const zec = run.assets.find((a) => a.asset === "ZEC");
    expect(zec?.lastSig).toBeTruthy();
    expect(zec?.lastError).toBeNull();
  });

  test("retries the same signed bytes on the next RPC when sendTransaction 429s", async () => {
    const store = new MemoryStore();
    const rpcCalls: RpcCall[] = [];
    let firstSendUrl: string | null = null;
    const results = await runOnce(
      makeEnv(store),
      NOW,
      makeFetch({
        rpcCalls,
        onSend: (url, _params, _call) => {
          // Always 429 the tick's first RPC so we fall over to the other with the same bytes.
          const first = NOW % 2 === 0 ? ONF : TAT;
          if (url.startsWith(first)) {
            firstSendUrl = url;
            return new Response("slow down", { status: 429, headers: { "retry-after": "0.001" } });
          }
          return null;
        },
      }),
    );
    expect(results.filter((r) => r.error)).toEqual([]);
    expect(results.filter((r) => r.sig).length).toBe(5);
    const sends = rpcCalls.filter((c) => c.method === "sendTransaction");
    // Lean retries=1 means the first URL is tried twice, then fallback.
    const firstUrlSends = sends.filter((c) => c.url.startsWith(firstSendUrl!));
    const otherSends = sends.filter((c) => !c.url.startsWith(firstSendUrl!));
    expect(firstUrlSends.length).toBeGreaterThanOrEqual(1);
    expect(otherSends.length).toBeGreaterThanOrEqual(1);
    const firstPayloads = [...new Set(firstUrlSends.map((c) => (c.params as [string, unknown])[0]))];
    const otherPayloads = otherSends.map((c) => (c.params as [string, unknown])[0]);
    // A 429'd batch is retried on the fallback with identical signed bytes.
    // Later batches start on the rotated RPC, so fallback payloads can also include those.
    expect(firstPayloads.length).toBeGreaterThanOrEqual(1);
    for (const payload of firstPayloads) {
      expect(otherPayloads).toContain(payload);
    }
    for (const s of sends) {
      expect((s.params as [string, { skipPreflight?: boolean }])[1].skipPreflight).toBe(true);
    }
  });
});

/** MemoryStore whose every D1-style call fails, like the Cloudflare D1 free daily limit. */
class DownStore extends MemoryStore {
  calls = 0;
  constructor() {
    super();
    for (const m of ["listPendingSigs", "addPendingSigs", "removePendingSigs", "loadRelayerRun", "saveRelayerRun"]) {
      (this as unknown as Record<string, unknown>)[m] = async () => {
        this.calls++;
        throw new Error("D1_ERROR: Exceeded maximum daily rows read limit");
      };
    }
  }
}

describe("runOnce with D1 down", () => {
  test("still posts onchain, holds pending sigs in memory, and confirms them next tick", async () => {
    resetMemoryState();
    const store = new DownStore();
    const env = makeEnv(store);
    const rpcCalls: RpcCall[] = [];
    const first = await runOnce(env, NOW, makeFetch({ rpcCalls }));
    expect(first.filter((r) => r.sig).length).toBe(5);
    expect(first.filter((r) => r.error)).toEqual([]);
    expect(rpcCalls.filter((c) => c.method === "sendTransaction").length).toBeGreaterThan(0);
    await expect(persistRun(store, first, NOW, null)).resolves.toBeUndefined();
    expect(store.calls).toBeGreaterThan(0);

    // Next tick: one sig still unconfirmed, the rest confirmed; pending comes from memory.
    const sigs = [...new Set(first.filter((r) => r.sig).map((r) => r.sig!))];
    const stuck = sigs[0];
    const stuckAssets = first.filter((r) => r.sig === stuck).map((r) => r.asset).sort();
    const rpc2: RpcCall[] = [];
    const second = await runOnce(
      env,
      NOW + 60,
      makeFetch({
        rpcCalls: rpc2,
        onStatuses: (asked) =>
          asked.map((s) => (s === stuck ? null : { slot: 1, confirmations: 1, err: null, confirmationStatus: "confirmed" })),
      }),
    );
    const status = rpc2.filter((c) => c.method === "getSignatureStatuses");
    expect(status).toHaveLength(1);
    expect((status[0].params as [string[]])[0].slice().sort()).toEqual(sigs.slice().sort());
    expect(second.filter((r) => r.skipped === "pending confirmation").map((r) => r.asset).sort()).toEqual(stuckAssets);
    expect(second.filter((r) => r.sig).length).toBe(5 - stuckAssets.length);
    resetMemoryState();
  });
});

