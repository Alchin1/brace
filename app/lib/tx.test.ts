import { describe, expect, it } from "vitest";
import { BN, BorshInstructionCoder, type Idl } from "@coral-xyz/anchor";
import { Keypair, PublicKey, SystemProgram, type TransactionInstruction } from "@solana/web3.js";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import idl from "./idl.json";
import { PROGRAM_ID } from "./brace";
import {
  IX_DISCRIMINATOR,
  borrowIx,
  borrowIxs,
  createUsdAtaIx,
  depositIx,
  encodeIx,
  openPositionIx,
  poolPda,
  positionPda,
  repayIx,
  usdAta,
  usdMintPda,
  withdrawIx,
} from "./tx";

type IdlSeed = { kind: string; value?: number[]; path?: string };
type IdlAccount = { name: string; writable?: boolean; signer?: boolean; address?: string; pda?: { seeds: IdlSeed[] } };
type IdlIx = { name: string; discriminator: number[]; accounts: IdlAccount[]; args: { name: string }[] };

const IDL = idl as unknown as { instructions: IdlIx[] };
const coder = new BorshInstructionCoder(idl as Idl);
const owner = Keypair.generate().publicKey;

function idlIx(name: string): IdlIx {
  const i = IDL.instructions.find((x) => x.name === name);
  if (!i) throw new Error(`no ${name} in IDL`);
  return i;
}

/** Resolves an IDL account to a pubkey: fixed address, PDA from its seeds, or the owner's test USD ATA. */
function expectedKey(a: IdlAccount): PublicKey {
  if (a.address) return new PublicKey(a.address);
  if (a.pda) {
    const seeds = a.pda.seeds.map((s) => {
      if (s.kind === "const") return Uint8Array.from(s.value!);
      if (s.kind === "account" && s.path === "owner") return owner.toBytes();
      throw new Error(`unhandled seed ${JSON.stringify(s)}`);
    });
    return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
  }
  if (a.name === "owner") return owner;
  if (a.name === "owner_token") {
    return getAssociatedTokenAddressSync(usdMintPda(), owner, false, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  }
  throw new Error(`cannot resolve ${a.name}`);
}

function checkAgainstIdl(name: string, built: TransactionInstruction, amount?: bigint) {
  const def = idlIx(name);
  expect(built.programId.equals(PROGRAM_ID)).toBe(true);
  expect(built.keys).toHaveLength(def.accounts.length);
  def.accounts.forEach((a, i) => {
    const k = built.keys[i];
    expect(k.pubkey.toBase58(), `${name}.${a.name} pubkey`).toBe(expectedKey(a).toBase58());
    expect(k.isWritable, `${name}.${a.name} writable`).toBe(!!a.writable);
    expect(k.isSigner, `${name}.${a.name} signer`).toBe(!!a.signer);
  });
  // Data: discriminator + u64 LE, and Anchor's own coder agrees.
  expect(Array.from(built.data.subarray(0, 8))).toEqual(def.discriminator);
  const args = def.args.length ? { [def.args[0].name]: new BN(amount!.toString()) } : {};
  expect(Buffer.from(built.data).equals(coder.encode(name, args))).toBe(true);
  const decoded = coder.decode(Buffer.from(built.data));
  expect(decoded?.name).toBe(name);
}

describe("instruction builders match the IDL", () => {
  it("discriminators equal the IDL", () => {
    for (const [name, disc] of Object.entries(IX_DISCRIMINATOR)) expect([...disc]).toEqual(idlIx(name).discriminator);
  });

  it("open_position", () => {
    checkAgainstIdl("open_position", openPositionIx(owner));
    expect(openPositionIx(owner).data).toHaveLength(8);
  });

  it("deposit", () => checkAgainstIdl("deposit", depositIx(owner, 500_000_000n), 500_000_000n));
  it("borrow", () => checkAgainstIdl("borrow", borrowIx(owner, 123_450_000n), 123_450_000n));
  it("repay", () => checkAgainstIdl("repay", repayIx(owner, 1n), 1n));
  it("withdraw", () => checkAgainstIdl("withdraw", withdrawIx(owner, 2n ** 64n - 1n), 2n ** 64n - 1n));

  it("encodes u64 little-endian and rejects out of range", () => {
    const d = encodeIx(IX_DISCRIMINATOR.borrow, 0x0102030405060708n);
    expect(Array.from(d.subarray(8))).toEqual([8, 7, 6, 5, 4, 3, 2, 1]);
    expect(() => encodeIx(IX_DISCRIMINATOR.borrow, -1n)).toThrow();
    expect(() => encodeIx(IX_DISCRIMINATOR.borrow, 2n ** 64n)).toThrow();
  });
});

describe("test USD account", () => {
  it("borrow sends idempotent ATA creation first, then borrow to that ATA", () => {
    const [ata, b] = borrowIxs(owner, 5n);
    expect(ata.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    // CreateIdempotent is instruction index 1 of the ATA program.
    expect(Array.from(ata.data)).toEqual([1]);
    const keys = ata.keys.map((k) => [k.pubkey.toBase58(), k.isSigner, k.isWritable]);
    expect(keys).toEqual([
      [owner.toBase58(), true, true],
      [usdAta(owner).toBase58(), false, true],
      [owner.toBase58(), false, false],
      [usdMintPda().toBase58(), false, false],
      [SystemProgram.programId.toBase58(), false, false],
      [TOKEN_PROGRAM_ID.toBase58(), false, false],
    ]);
    expect(b.keys[6].pubkey.equals(usdAta(owner))).toBe(true);
    expect(createUsdAtaIx(owner).data).toEqual(ata.data);
  });

  it("PDAs use the program seeds", () => {
    const [pos] = PublicKey.findProgramAddressSync([Buffer.from("position"), owner.toBuffer()], PROGRAM_ID);
    expect(positionPda(owner).equals(pos)).toBe(true);
    expect(poolPda().equals(PublicKey.findProgramAddressSync([Buffer.from("pool")], PROGRAM_ID)[0])).toBe(true);
  });
});
