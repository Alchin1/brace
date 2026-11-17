import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { ComputeBudgetProgram, Keypair, PublicKey } from "@solana/web3.js";
import { describe, expect, test } from "vitest";
import { CU_LIMIT } from "../src/assets.ts";
import { toHex } from "../src/encode.ts";
import { buildPostQuotesTransaction, feedPda, postQuotesInstruction, postQuotesKeys } from "../src/tx.ts";
import twoQuote from "./fixtures/two-quote-ix.json";
import worker from "../src/index.ts";
import type { Env } from "../src/index.ts";

const root = dirname(fileURLToPath(import.meta.url));
const PROGRAM_ID = new PublicKey(twoQuote.programId);

describe("transaction accounts and compute budget", () => {
  test("account metas match the IDL: relayer signer+writable, feed writable, config and system readonly", () => {
    const relayer = Keypair.generate();
    const ix = postQuotesInstruction(PROGRAM_ID, relayer.publicKey, {
      symbol: twoQuote.symbol,
      expiryTs: twoQuote.expiryTs,
      ticker: twoQuote.ticker,
      spotE6: BigInt(twoQuote.spotE6),
      quotes: twoQuote.quotes.map((q) => ({
        strikeE6: BigInt(q.strikeE6),
        bidBps: q.bidBps,
        askBps: q.askBps,
      })),
    });
    const idl = JSON.parse(readFileSync(join(root, "../src/idl.json"), "utf8"));
    const spec = idl.instructions.find((i: { name: string }) => i.name === "post_quotes");
    expect(ix.keys).toHaveLength(spec.accounts.length);
    expect(ix.keys[0]).toMatchObject({ pubkey: relayer.publicKey, isSigner: true, isWritable: true });
    const keys = postQuotesKeys(PROGRAM_ID, relayer.publicKey, "SOL");
    expect(ix.keys[1]).toMatchObject({ pubkey: keys.config, isSigner: false, isWritable: false });
    expect(ix.keys[2]).toMatchObject({ pubkey: keys.feed, isSigner: false, isWritable: true });
    expect(ix.keys[3].pubkey.toBase58()).toBe("11111111111111111111111111111111");
    expect(ix.programId.toBase58()).toBe(twoQuote.programId);
    expect(toHex(ix.data)).toBe(twoQuote.dataHex);
  });

  test("built transaction is signed and prepends the 120k CU limit plus a tiny priority fee", () => {
    const relayer = Keypair.generate();
    const tx = buildPostQuotesTransaction({
      programId: PROGRAM_ID,
      relayer,
      recentBlockhash: "11111111111111111111111111111111",
      symbol: twoQuote.symbol,
      expiryTs: twoQuote.expiryTs,
      ticker: twoQuote.ticker,
      spotE6: BigInt(twoQuote.spotE6),
      quotes: twoQuote.quotes.map((q) => ({
        strikeE6: BigInt(q.strikeE6),
        bidBps: q.bidBps,
        askBps: q.askBps,
      })),
    });
    expect(tx.instructions).toHaveLength(3);
    expect(tx.instructions[0].programId.equals(ComputeBudgetProgram.programId)).toBe(true);
    expect(tx.instructions[1].programId.equals(ComputeBudgetProgram.programId)).toBe(true);
    const cuIx = ComputeBudgetProgram.setComputeUnitLimit({ units: CU_LIMIT });
    expect(toHex(tx.instructions[0].data)).toBe(toHex(cuIx.data));
    expect(toHex(tx.instructions[2].data)).toBe(twoQuote.dataHex);
    expect(tx.verifySignatures()).toBe(true);
    expect(tx.feePayer?.equals(relayer.publicKey)).toBe(true);
  });

  test("SOL feed PDA matches PublicKey.findProgramAddressSync with the program id", () => {
    const feed = feedPda(PROGRAM_ID, "SOL");
    const [expected] = PublicKey.findProgramAddressSync(
      [Buffer.from("feed"), Buffer.from("SOL\0\0\0\0\0")],
      PROGRAM_ID,
    );
    expect(feed.equals(expected)).toBe(true);
  });
});

describe("worker HTTP", () => {
  test("/health reports ok and empty run state", async () => {
    const env: Env = { PROGRAM_ID: twoQuote.programId };
    const res = await worker.fetch(new Request("https://example.com/health"), env);
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; lastRun: string | null; lastSigs: Record<string, string> };
    expect(body.ok).toBe(true);
    expect(body.lastRun).toBeNull();
    expect(body.lastSigs).toEqual({});
  });

  test("unknown path is 404", async () => {
    const env: Env = { PROGRAM_ID: twoQuote.programId };
    const res = await worker.fetch(new Request("https://example.com/"), env);
    expect(res.status).toBe(404);
  });
});
