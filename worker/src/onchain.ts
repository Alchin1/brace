/** Feed timestamps read straight from the program, for /health when D1 is unavailable. */
import { PublicKey } from "@solana/web3.js";
import { ASSETS } from "./assets.ts";
import { withRpcFallback } from "./rpc.ts";

/** Anchor discriminator of the Feed account (target/idl/brace.json). */
export const FEED_DISCRIMINATOR = [69, 191, 16, 227, 132, 187, 84, 227];
/** Byte offset of Feed.posted_at (i64 LE): 8 disc + 8 symbol + 4*8 + 1 points + 8 expiry + 32 ticker + 1 + 2 + 1 + 8 last_valid_at. */
export const FEED_POSTED_AT_OFFSET = 101;

export function feedPda(symbol: string, programId: PublicKey): PublicKey {
  const sym = new Uint8Array(8);
  for (let i = 0; i < symbol.length && i < 8; i++) sym[i] = symbol.charCodeAt(i);
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("feed"), sym], programId)[0];
}

export function decodePostedAt(data: Uint8Array): number | null {
  if (data.length < FEED_POSTED_AT_OFFSET + 8) return null;
  for (let i = 0; i < 8; i++) if (data[i] !== FEED_DISCRIMINATOR[i]) return null;
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const v = Number(view.getBigInt64(FEED_POSTED_AT_OFFSET, true));
  return v > 0 ? v : null;
}

function base64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** posted_at per asset from one getMultipleAccounts call. Assets with no feed account are left out. */
export async function onchainPostedAt(
  programId: PublicKey,
  urls: string[],
  rpcFetch: typeof fetch,
): Promise<Record<string, number>> {
  const keys = ASSETS.map((a) => feedPda(a.symbol, programId).toBase58());
  const { result } = await withRpcFallback(
    urls,
    async (url) => {
      const res = await rpcFetch(url, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getMultipleAccounts", params: [keys, { encoding: "base64", commitment: "confirmed" }] }),
      });
      if (!res.ok) throw new Error(`rpc http ${res.status}`);
      const body = (await res.json()) as { result?: { value?: ({ data?: [string, string] } | null)[] }; error?: { message?: string } };
      if (body.error || !body.result?.value) throw new Error(`rpc error ${body.error?.message ?? "no result"}`);
      return body.result.value;
    },
    { retries: 1 },
  );
  const out: Record<string, number> = {};
  ASSETS.forEach((a, i) => {
    const acc = result[i];
    if (!acc?.data?.[0]) return;
    const ts = decodePostedAt(base64ToBytes(acc.data[0]));
    if (ts != null) out[a.symbol] = ts;
  });
  return out;
}
