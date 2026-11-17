import { ComputeBudgetProgram, PublicKey, Transaction, TransactionInstruction, type Keypair } from "@solana/web3.js";
import { CU_LIMIT, PRIORITY_MICRO_LAMPORTS } from "./assets.ts";
import { encodePostQuotes, symbolBytes, type Quote } from "./encode.ts";

export const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");

export function configPda(programId: PublicKey): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("config")], programId)[0];
}

export function feedPda(programId: PublicKey, symbol: string): PublicKey {
  return PublicKey.findProgramAddressSync([Buffer.from("feed"), Buffer.from(symbolBytes(symbol))], programId)[0];
}

export type PostQuotesAccounts = {
  relayer: PublicKey;
  config: PublicKey;
  feed: PublicKey;
  systemProgram: PublicKey;
};

export function postQuotesKeys(programId: PublicKey, relayer: PublicKey, symbol: string): PostQuotesAccounts {
  return {
    relayer,
    config: configPda(programId),
    feed: feedPda(programId, symbol),
    systemProgram: SYSTEM_PROGRAM_ID,
  };
}

export function postQuotesInstruction(
  programId: PublicKey,
  relayer: PublicKey,
  args: { symbol: string; expiryTs: number; ticker: string; spotE6: bigint; quotes: Quote[] },
): TransactionInstruction {
  const keys = postQuotesKeys(programId, relayer, args.symbol);
  return new TransactionInstruction({
    programId,
    keys: [
      { pubkey: keys.relayer, isSigner: true, isWritable: true },
      { pubkey: keys.config, isSigner: false, isWritable: false },
      { pubkey: keys.feed, isSigner: false, isWritable: true },
      { pubkey: keys.systemProgram, isSigner: false, isWritable: false },
    ],
    data: Buffer.from(encodePostQuotes(args)),
  });
}

export function buildPostQuotesTransaction(opts: {
  programId: PublicKey;
  relayer: Keypair;
  recentBlockhash: string;
  symbol: string;
  expiryTs: number;
  ticker: string;
  spotE6: bigint;
  quotes: Quote[];
  cuLimit?: number;
  priorityMicroLamports?: number;
}): Transaction {
  const tx = new Transaction();
  tx.feePayer = opts.relayer.publicKey;
  tx.recentBlockhash = opts.recentBlockhash;
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: opts.cuLimit ?? CU_LIMIT }));
  tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: opts.priorityMicroLamports ?? PRIORITY_MICRO_LAMPORTS }));
  tx.add(
    postQuotesInstruction(opts.programId, opts.relayer.publicKey, {
      symbol: opts.symbol,
      expiryTs: opts.expiryTs,
      ticker: opts.ticker,
      spotE6: opts.spotE6,
      quotes: opts.quotes,
    }),
  );
  tx.sign(opts.relayer);
  return tx;
}

/** Legacy Solana packet data limit. A signed transaction must fit in this many bytes to propagate. */
export const PACKET_DATA_SIZE = 1232;
/** Compute-unit limit per transaction. */
export const MAX_TX_CU = 1_400_000;
/**
 * CU budget reserved per post_quotes in a packed tx.
 * Measured on-chain: 68,416 (create feed) / 66,122 (update). 80k leaves headroom.
 */
export const POST_CU_BUDGET = 80_000;
export const PACK_CU_OVERHEAD = 10_000;

export type PackedPost = {
  symbol: string;
  expiryTs: number;
  ticker: string;
  spotE6: bigint;
  quotes: Quote[];
};

export function packedCuLimit(nPosts: number): number {
  return Math.min(MAX_TX_CU, nPosts * POST_CU_BUDGET + PACK_CU_OVERHEAD);
}

export function buildPackedPostQuotesTransaction(opts: {
  programId: PublicKey;
  relayer: Keypair;
  recentBlockhash: string;
  posts: PackedPost[];
  priorityMicroLamports?: number;
}): Transaction {
  if (!opts.posts.length) throw new Error("no posts to pack");
  const tx = new Transaction();
  tx.feePayer = opts.relayer.publicKey;
  tx.recentBlockhash = opts.recentBlockhash;
  tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: packedCuLimit(opts.posts.length) }));
  tx.add(
    ComputeBudgetProgram.setComputeUnitPrice({
      microLamports: opts.priorityMicroLamports ?? PRIORITY_MICRO_LAMPORTS,
    }),
  );
  for (const post of opts.posts) {
    tx.add(
      postQuotesInstruction(opts.programId, opts.relayer.publicKey, {
        symbol: post.symbol,
        expiryTs: post.expiryTs,
        ticker: post.ticker,
        spotE6: post.spotE6,
        quotes: post.quotes,
      }),
    );
  }
  tx.sign(opts.relayer);
  return tx;
}

/** Compact-u16 length used in the legacy transaction wire format. */
function compactU16Bytes(n: number): number {
  if (n < 0x80) return 1;
  if (n < 0x4000) return 2;
  return 3;
}

/**
 * Wire size of a signed legacy transaction, including cases that exceed
 * PACKET_DATA_SIZE. `Transaction.serialize()` throws above 1232 bytes, so
 * packing cannot use it to decide whether a candidate fits.
 */
export function signedTxSize(tx: Transaction): number {
  const message = tx.serializeMessage();
  const n = tx.signatures.length;
  return compactU16Bytes(n) + n * 64 + message.length;
}

export function packPostBatches(opts: {
  programId: PublicKey;
  relayer: Keypair;
  recentBlockhash: string;
  posts: PackedPost[];
  priorityMicroLamports?: number;
}): { tx: Transaction; posts: PackedPost[]; size: number; cuLimit: number }[] {
  const batches: { tx: Transaction; posts: PackedPost[]; size: number; cuLimit: number }[] = [];
  let current: PackedPost[] = [];

  const build = (posts: PackedPost[]) =>
    buildPackedPostQuotesTransaction({
      programId: opts.programId,
      relayer: opts.relayer,
      recentBlockhash: opts.recentBlockhash,
      posts,
      priorityMicroLamports: opts.priorityMicroLamports,
    });

  const fits = (posts: PackedPost[]): { tx: Transaction; size: number; cuLimit: number } | null => {
    const cuLimit = packedCuLimit(posts.length);
    if (cuLimit > MAX_TX_CU) return null;
    const tx = build(posts);
    const size = signedTxSize(tx);
    if (size > PACKET_DATA_SIZE) return null;
    return { tx, size, cuLimit };
  };

  for (const post of opts.posts) {
    const candidate = [...current, post];
    const ok = fits(candidate);
    if (ok) {
      current = candidate;
      continue;
    }
    if (current.length) {
      const built = fits(current);
      if (!built) throw new Error("packed batch that previously fit no longer fits");
      batches.push({ ...built, posts: current });
    }
    current = [post];
    const alone = fits(current);
    if (!alone) {
      throw new Error(`post_quotes for ${post.symbol} with ${post.quotes.length} quotes exceeds the 1232-byte packet limit`);
    }
  }
  if (current.length) {
    const built = fits(current);
    if (!built) throw new Error("final packed batch does not fit");
    batches.push({ ...built, posts: current });
  }
  return batches;
}
