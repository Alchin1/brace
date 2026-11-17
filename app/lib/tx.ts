// Brace user instructions, built by hand from the IDL (lib/idl.json).
// Pure: every builder takes pubkeys and an amount and returns instructions.
// lib/tx.test.ts checks account order, writability, signers and data against the IDL.

import { Buffer } from "buffer";
import { PublicKey, SystemProgram, TransactionInstruction, type AccountMeta } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { PROGRAM_ID, configPda, feedPda } from "./brace";

export const IX_DISCRIMINATOR = {
  open_position: [135, 128, 47, 77, 15, 152, 240, 49],
  deposit: [242, 35, 198, 137, 82, 225, 242, 182],
  borrow: [228, 253, 131, 202, 207, 116, 89, 18],
  repay: [234, 103, 67, 82, 208, 234, 219, 166],
  withdraw: [183, 18, 70, 156, 148, 109, 161, 34],
} as const;

const enc = (s: string) => new TextEncoder().encode(s);

export function positionPda(owner: PublicKey, programId: PublicKey = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([enc("position"), owner.toBytes()], programId)[0];
}

export function poolPda(programId: PublicKey = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([enc("pool")], programId)[0];
}

export function usdMintPda(programId: PublicKey = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([enc("usd_mint")], programId)[0];
}

export function solFeedPda(programId: PublicKey = PROGRAM_ID): PublicKey {
  return feedPda("SOL", programId);
}

/** The owner's associated token account for test USD. */
export function usdAta(owner: PublicKey, programId: PublicKey = PROGRAM_ID): PublicKey {
  return getAssociatedTokenAddressSync(usdMintPda(programId), owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}

const U64_MAX = (1n << 64n) - 1n;

/** 8-byte discriminator followed by an optional u64 little-endian argument. */
export function encodeIx(disc: readonly number[], amount?: bigint): Buffer {
  const out = Buffer.alloc(amount === undefined ? 8 : 16);
  out.set(disc, 0);
  if (amount !== undefined) {
    if (amount < 0n || amount > U64_MAX) throw new Error("amount out of u64 range");
    out.writeBigUInt64LE(amount, 8);
  }
  return out;
}

const w = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: true });
const r = (pubkey: PublicKey): AccountMeta => ({ pubkey, isSigner: false, isWritable: false });

function ix(keys: AccountMeta[], data: Buffer, programId: PublicKey): TransactionInstruction {
  return new TransactionInstruction({ programId, keys, data });
}

export function openPositionIx(owner: PublicKey, programId: PublicKey = PROGRAM_ID): TransactionInstruction {
  return ix(
    [{ pubkey: owner, isSigner: true, isWritable: true }, w(positionPda(owner, programId)), r(SystemProgram.programId)],
    encodeIx(IX_DISCRIMINATOR.open_position),
    programId,
  );
}

export function depositIx(owner: PublicKey, lamports: bigint, programId: PublicKey = PROGRAM_ID): TransactionInstruction {
  return ix(
    [
      { pubkey: owner, isSigner: true, isWritable: true },
      w(positionPda(owner, programId)),
      w(poolPda(programId)),
      r(SystemProgram.programId),
    ],
    encodeIx(IX_DISCRIMINATOR.deposit, lamports),
    programId,
  );
}

export function borrowIx(owner: PublicKey, amount: bigint, programId: PublicKey = PROGRAM_ID): TransactionInstruction {
  return ix(
    [
      { pubkey: owner, isSigner: true, isWritable: false },
      w(positionPda(owner, programId)),
      w(poolPda(programId)),
      r(configPda(programId)),
      r(solFeedPda(programId)),
      w(usdMintPda(programId)),
      w(usdAta(owner, programId)),
      r(TOKEN_PROGRAM_ID),
    ],
    encodeIx(IX_DISCRIMINATOR.borrow, amount),
    programId,
  );
}

export function repayIx(owner: PublicKey, amount: bigint, programId: PublicKey = PROGRAM_ID): TransactionInstruction {
  return ix(
    [
      { pubkey: owner, isSigner: true, isWritable: false },
      w(positionPda(owner, programId)),
      w(poolPda(programId)),
      w(usdMintPda(programId)),
      w(usdAta(owner, programId)),
      r(TOKEN_PROGRAM_ID),
    ],
    encodeIx(IX_DISCRIMINATOR.repay, amount),
    programId,
  );
}

export function withdrawIx(owner: PublicKey, lamports: bigint, programId: PublicKey = PROGRAM_ID): TransactionInstruction {
  return ix(
    [
      { pubkey: owner, isSigner: true, isWritable: true },
      w(positionPda(owner, programId)),
      w(poolPda(programId)),
      r(configPda(programId)),
      r(solFeedPda(programId)),
    ],
    encodeIx(IX_DISCRIMINATOR.withdraw, lamports),
    programId,
  );
}

/** Creates the owner's test USD account if missing; a no-op when it exists. */
export function createUsdAtaIx(owner: PublicKey, programId: PublicKey = PROGRAM_ID): TransactionInstruction {
  return createAssociatedTokenAccountIdempotentInstruction(
    owner,
    usdAta(owner, programId),
    owner,
    usdMintPda(programId),
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID,
  );
}

/** A borrow as sent: idempotent ATA creation, then borrow. */
export function borrowIxs(owner: PublicKey, amount: bigint, programId: PublicKey = PROGRAM_ID): TransactionInstruction[] {
  return [createUsdAtaIx(owner, programId), borrowIx(owner, amount, programId)];
}
