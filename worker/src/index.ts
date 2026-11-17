import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { ASSETS, type Asset } from "./assets.ts";
import { checkSinkSecret, readJsonBody, SINK_SECRET_HEADER, verifyQuickNodeSignature } from "./auth.ts";
import { encodePostQuotes, toHex } from "./encode.ts";
import { fetchEvents, fetchSpotE6 } from "./gemini.ts";
import { actionsResponse, historyResponse, parseSince } from "./history.ts";
import { parseRpcUrls, rpcAwareFetch, withRpcFallback } from "./rpc.ts";
import { selectLadder } from "./select.ts";
import { buildHealthReport, D1Store, type BraceStore, type RelayerAssetState, type RelayerRunState } from "./store.ts";
import { ingestPayload } from "./streams.ts";
import { buildPostQuotesTransaction } from "./tx.ts";

export type Env = {
  PROGRAM_ID: string;
  RPC_URL?: string;
  RPC_URLS?: string;
  RELAYER_SECRET?: string;
  STREAMS_SINK_SECRET?: string;
  QN_SECURITY_TOKEN?: string;
  DB?: D1Database;
  /** Test-only in-memory store. */
  __store?: BraceStore;
};

type RunResult = { asset: string; ticker?: string; sig?: string; skipped?: string; error?: string };

const state: { lastRun: string | null; lastSigs: Record<string, string> } = {
  lastRun: null,
  lastSigs: {},
};

function assetBySymbol(symbol: string): Asset | undefined {
  return ASSETS.find((a) => a.symbol === symbol.toUpperCase());
}

function loadRelayer(secret: string | undefined): Keypair {
  if (!secret) throw new Error("RELAYER_SECRET is not set");
  const bytes = bs58.decode(secret.trim());
  if (bytes.length !== 64) throw new Error("RELAYER_SECRET must be a base58 64-byte secret key");
  return Keypair.fromSecretKey(bytes);
}

export async function previewAsset(
  symbol: string,
  nowSeconds: number,
  fetchFn: typeof fetch = fetch,
): Promise<Record<string, unknown>> {
  const asset = assetBySymbol(symbol);
  if (!asset) return { error: `unknown asset ${symbol}` };
  const events = await fetchEvents(fetchFn);
  const ladder = selectLadder(events, asset, nowSeconds);
  if (!ladder) return { asset: asset.symbol, selected: null };
  const spotE6 = await fetchSpotE6(asset, fetchFn);
  const data = encodePostQuotes({
    symbol: asset.symbol,
    expiryTs: ladder.expiryTs,
    ticker: ladder.ticker,
    spotE6,
    quotes: ladder.quotes,
  });
  return {
    asset: asset.symbol,
    ticker: ladder.ticker,
    expiryTs: ladder.expiryTs,
    spotE6: spotE6.toString(),
    quotes: ladder.quotes.map((q) => ({
      strikeE6: q.strikeE6.toString(),
      bidBps: q.bidBps,
      askBps: q.askBps,
    })),
    tightCount: ladder.tightCount,
    dataHex: toHex(data),
  };
}

export async function runOnce(env: Env, nowSeconds: number, fetchFn: typeof fetch = fetch): Promise<RunResult[]> {
  const results: RunResult[] = [];
  const events = await fetchEvents(fetchFn);
  const relayer = loadRelayer(env.RELAYER_SECRET);
  const programId = new PublicKey(env.PROGRAM_ID);
  const urls = parseRpcUrls(env);
  const rpcFetch = rpcAwareFetch(fetchFn);

  for (const asset of ASSETS) {
    try {
      const ladder = selectLadder(events, asset, nowSeconds);
      if (!ladder) {
        results.push({ asset: asset.symbol, skipped: "no valid ladder" });
        continue;
      }
      const spotE6 = await fetchSpotE6(asset, fetchFn);
      const { result: sig } = await withRpcFallback(urls, async (url) => {
        const connection = new Connection(url, {
          commitment: "confirmed",
          fetch: rpcFetch,
          disableRetryOnRateLimit: true,
        });
        const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;
        const tx = buildPostQuotesTransaction({
          programId,
          relayer,
          recentBlockhash,
          symbol: asset.symbol,
          expiryTs: ladder.expiryTs,
          ticker: ladder.ticker,
          spotE6,
          quotes: ladder.quotes,
        });
        return await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
      });
      results.push({ asset: asset.symbol, ticker: ladder.ticker, sig });
      // Log only signatures and tickers.
      console.log(`brace post ${asset.symbol} ${ladder.ticker} ${sig}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      results.push({ asset: asset.symbol, error: message });
      console.log(`brace post ${asset.symbol} error`);
    }
  }
  return results;
}

export async function persistRun(
  store: BraceStore | null,
  results: RunResult[],
  nowSeconds: number,
  runError: string | null,
): Promise<void> {
  const lastRun = new Date(nowSeconds * 1000).toISOString();
  const assetErrors = results.filter((r) => r.error).map((r) => `${r.asset}: ${r.error}`);
  const lastError = runError ?? (assetErrors.length ? assetErrors.join("; ") : null);
  state.lastRun = lastRun;
  for (const r of results) {
    if (r.sig) state.lastSigs[r.asset] = r.sig;
  }
  if (!store) return;
  const prev = await store.loadRelayerRun();
  const byAsset = new Map(prev.assets.map((a) => [a.asset, a]));
  for (const r of results) {
    const prevA: RelayerAssetState = byAsset.get(r.asset) ?? {
      asset: r.asset,
      lastSig: null,
      lastAt: null,
      lastError: null,
    };
    if (r.sig) {
      byAsset.set(r.asset, { asset: r.asset, lastSig: r.sig, lastAt: nowSeconds, lastError: null });
    } else if (r.error) {
      byAsset.set(r.asset, { ...prevA, lastError: r.error });
    }
  }
  const next: RelayerRunState = { lastRun, lastError, assets: [...byAsset.values()] };
  await store.saveRelayerRun(next);
}

export async function healthReport(store: BraceStore | null, nowSeconds: number) {
  if (store) {
    const run = await store.loadRelayerRun();
    const latestPosts = await store.latestPostTsByAsset();
    return buildHealthReport(run, latestPosts, nowSeconds);
  }
  return {
    ok: true,
    lastRun: state.lastRun,
    lastError: null as string | null,
    lastSigs: state.lastSigs,
    feeds: {} as Record<string, never>,
  };
}

function corsHeaders(): Record<string, string> {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "content-type",
  };
}

function corsJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders() });
}

function storeFromEnv(env: Env): BraceStore | null {
  if (env.__store) return env.__store;
  if (env.DB) return new D1Store(env.DB);
  return null;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS" && (url.pathname === "/history" || url.pathname === "/actions" || url.pathname === "/health")) {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }
    if (url.pathname === "/health") {
      return corsJson(await healthReport(storeFromEnv(env), Math.floor(Date.now() / 1000)));
    }
    if (url.pathname === "/preview") {
      const symbol = url.searchParams.get("asset") || "SOL";
      try {
        const body = await previewAsset(symbol, Math.floor(Date.now() / 1000));
        return corsJson(body);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return corsJson({ error: message }, 502);
      }
    }
    if (url.pathname === "/history" && request.method === "GET") {
      const store = storeFromEnv(env);
      if (!store) return corsJson({ error: "history store is not configured" }, 503);
      const asset = url.searchParams.get("asset") || undefined;
      const since = parseSince(url.searchParams.get("since"));
      return corsJson(await historyResponse(store, asset, since));
    }
    if (url.pathname === "/actions" && request.method === "GET") {
      const store = storeFromEnv(env);
      if (!store) return corsJson({ error: "history store is not configured" }, 503);
      const since = parseSince(url.searchParams.get("since"));
      return corsJson(await actionsResponse(store, since));
    }
    if (url.pathname === "/streams" && request.method === "POST") {
      if (!checkSinkSecret(request.headers.get(SINK_SECRET_HEADER), env.STREAMS_SINK_SECRET)) {
        return Response.json({ error: "unauthorized" }, { status: 401 });
      }
      const bodyText = await readJsonBody(request);
      if (env.QN_SECURITY_TOKEN) {
        const ok = await verifyQuickNodeSignature({
          nonce: request.headers.get("x-qn-nonce") || "",
          timestamp: request.headers.get("x-qn-timestamp") || "",
          body: bodyText,
          signature: request.headers.get("x-qn-signature") || "",
          securityToken: env.QN_SECURITY_TOKEN,
        });
        if (!ok) return Response.json({ error: "invalid signature" }, { status: 401 });
      }
      const store = storeFromEnv(env);
      if (!store) return Response.json({ error: "history store is not configured" }, { status: 503 });
      let payload: unknown = {};
      if (bodyText.length) {
        try {
          payload = JSON.parse(bodyText);
        } catch {
          return Response.json({ error: "invalid json" }, { status: 400 });
        }
      }
      const result = await ingestPayload(store, payload);
      return Response.json({ ok: true, ...result });
    }
    return new Response("not found", { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        const now = Math.floor(Date.now() / 1000);
        const store = storeFromEnv(env);
        try {
          const results = await runOnce(env, now);
          await persistRun(store, results, now, null);
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.log(`brace cron error: ${message}`);
          try {
            await persistRun(store, [], now, message);
          } catch {
            console.log("brace cron error: failed to persist run state");
          }
        }
      })(),
    );
  },
};
