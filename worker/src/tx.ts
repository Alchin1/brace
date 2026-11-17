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
