import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import bs58 from "bs58";
import { ASSETS, type Asset } from "./assets.ts";
import { encodePostQuotes, toHex } from "./encode.ts";
import { fetchEvents, fetchSpotE6 } from "./gemini.ts";
import { selectLadder } from "./select.ts";
import { buildPostQuotesTransaction } from "./tx.ts";

export type Env = {
  PROGRAM_ID: string;
  RPC_URL?: string;
  RELAYER_SECRET?: string;
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
  const connection = new Connection(env.RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const recentBlockhash = (await connection.getLatestBlockhash()).blockhash;

  for (const asset of ASSETS) {
    try {
      const ladder = selectLadder(events, asset, nowSeconds);
      if (!ladder) {
        results.push({ asset: asset.symbol, skipped: "no valid ladder" });
        continue;
      }
      const spotE6 = await fetchSpotE6(asset, fetchFn);
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
      const sig = await connection.sendRawTransaction(tx.serialize(), { skipPreflight: false });
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

export default {
  async fetch(request: Request, _env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health") {
      return Response.json({ ok: true, lastRun: state.lastRun, lastSigs: state.lastSigs });
    }
    if (url.pathname === "/preview") {
      const symbol = url.searchParams.get("asset") || "SOL";
      try {
        const body = await previewAsset(symbol, Math.floor(Date.now() / 1000));
        return Response.json(body);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        return Response.json({ error: message }, { status: 502 });
      }
    }
    return new Response("not found", { status: 404 });
  },

  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(
      (async () => {
        try {
          const results = await runOnce(env, Math.floor(Date.now() / 1000));
          state.lastRun = new Date().toISOString();
          for (const r of results) {
            if (r.sig) state.lastSigs[r.asset] = r.sig;
          }
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          console.log(`brace cron error: ${message}`);
        }
      })(),
    );
  },
};
