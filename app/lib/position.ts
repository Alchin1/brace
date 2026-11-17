// Position decoding, the program's LTV math, amount parsing and error wording for /borrow.

import { PublicKey } from "@solana/web3.js";
import { pct1 } from "./chart";

export const POSITION_DISCRIMINATOR = [170, 188, 143, 228, 122, 64, 247, 208];
export const POSITION_SIZE = 8 + 32 + 8 + 8 + 1;
export const LAMPORTS_PER_SOL = 1_000_000_000n;
export const USD_DECIMALS = 6;
/** constants.rs MAX_PRICE_AGE_SECS: borrow refuses a spot older than this. */
export const MAX_PRICE_AGE_SECS = 3600;

export interface Position {
  owner: string;
  collateralLamports: bigint;
  debt: bigint;
  bump: number;
}

export function decodePosition(data: Uint8Array): Position {
  if (data.length < POSITION_SIZE) throw new Error("account data too short");
  for (let i = 0; i < 8; i++) if (data[i] !== POSITION_DISCRIMINATOR[i]) throw new Error("not a Position account");
  const v = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return {
    owner: new PublicKey(data.subarray(8, 40)).toBase58(),
    collateralLamports: v.getBigUint64(40, true),
    debt: v.getBigUint64(48, true),
    bump: data[56],
  };
}

/** state.rs collateral_value_e6: lamports * spot_e6 / 1e9, floored. */
export function collateralValueE6(lamports: bigint, spotE6: bigint): bigint {
  return (lamports * spotE6) / LAMPORTS_PER_SOL;
}

/** state.rs ltv_bps: rounded up; zero debt is 0; debt against zero value is 10001. */
export function ltvBps(debt: bigint, value: bigint): number {
  if (debt === 0n) return 0;
  if (value === 0n) return 10_001;
  return Number((debt * 10_000n + value - 1n) / value);
}

/** Largest extra borrow (base units) the program accepts at this limit. */
export function maxBorrow(debt: bigint, value: bigint, limitBps: number): bigint {
  const room = (value * BigInt(limitBps)) / 10_000n - debt;
  return room > 0n ? room : 0n;
}

/** Spot usable for pricing: same rule as Feed::fresh_spot_e6. */
export function priceFresh(hasValid: boolean, spotE6: bigint, lastValidAt: bigint, now: number): boolean {
  return hasValid && spotE6 > 0n && BigInt(now) - lastValidAt <= BigInt(MAX_PRICE_AGE_SECS);
}

/** "12.5" with `decimals` places to base units. Null when not a positive amount that fits. */
export function parseUnits(text: string, decimals: number): bigint | null {
  const s = text.trim();
  if (!/^\d*(\.\d*)?$/.test(s) || s === "" || s === ".") return null;
  const [whole, frac = ""] = s.split(".");
  if (frac.length > decimals) return null;
  const v = BigInt(whole || "0") * 10n ** BigInt(decimals) + BigInt((frac + "0".repeat(decimals)).slice(0, decimals) || "0");
  if (v <= 0n || v >= 1n << 64n) return null;
  return v;
}

/** Base units to a plain decimal string, trimmed to `shown` places (floored). */
export function formatUnits(v: bigint, decimals: number, shown: number): string {
  const neg = v < 0n;
  const a = neg ? -v : v;
  const base = 10n ** BigInt(decimals);
  const whole = a / base;
  const frac = (a % base).toString().padStart(decimals, "0").slice(0, shown);
  const w = whole.toLocaleString("en-US");
  return `${neg ? "-" : ""}${w}${shown > 0 ? "." + frac : ""}`;
}

// Errors

export const ERR = {
  RiskTightened: 6005,
  InsufficientCollateral: 6007,
  InvalidAmount: 6008,
  StalePrice: 6009,
} as const;

/** ltv and limit (bps) from the program's "brace blocked ltv=X limit=Y" log, if present. */
export function parseBlocked(logs: readonly string[] | null | undefined): { ltvBps: number; limitBps: number } | null {
  for (const l of logs ?? []) {
    const m = /brace blocked ltv=(\d+) limit=(\d+)/.exec(l);
    if (m) return { ltvBps: Number(m[1]), limitBps: Number(m[2]) };
  }
  return null;
}

/** Brace custom error code from a transaction error object, error message or logs. */
export function customCode(err: unknown, logs?: readonly string[] | null): number | null {
  const fromObj = (e: unknown): number | null => {
    if (!e || typeof e !== "object") return null;
    const ie = (e as { InstructionError?: unknown }).InstructionError;
    if (Array.isArray(ie) && ie[1] && typeof ie[1] === "object" && "Custom" in ie[1]) {
      const c = (ie[1] as { Custom: unknown }).Custom;
      return typeof c === "number" ? c : null;
    }
    return null;
  };
  const direct = fromObj(err);
  if (direct !== null) return direct;
  const texts = [err instanceof Error ? err.message : typeof err === "string" ? err : "", ...(logs ?? [])];
  for (const t of texts) {
    const hex = /custom program error: 0x([0-9a-f]+)/i.exec(t);
    if (hex) return parseInt(hex[1], 16);
    const num = /Error Number: (\d+)/.exec(t);
    if (num) return Number(num[1]);
    const json = /"Custom"\s*:\s*(\d+)/.exec(t);
    if (json) return Number(json[1]);
  }
  return null;
}

export function isWalletRejection(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const e = err as { code?: unknown; name?: unknown; message?: unknown; error?: unknown };
  if (e.code === 4001) return true;
  const inner = e.error as { code?: unknown } | undefined;
  if (inner && inner.code === 4001) return true;
  const msg = typeof e.message === "string" ? e.message : "";
  return /user rejected|rejected the request|user denied|declined|cancel/i.test(msg);
}

/** Plain-words result for a failed action. */
export function failureMessage(err: unknown, logs?: readonly string[] | null): string {
  if (isWalletRejection(err)) return "You cancelled in your wallet.";
  const code = customCode(err, logs);
  if (code === ERR.RiskTightened) {
    const b = parseBlocked(logs);
    if (b) return `Rejected onchain: this borrow would put you at ${pct1(b.ltvBps)} against a live limit of ${pct1(b.limitBps)}.`;
    return "Rejected onchain: this would put you over the live limit.";
  }
  if (code === ERR.StalePrice) return "Paused: the SOL price is more than an hour old, so the program blocks borrowing.";
  if (code === ERR.InvalidAmount) return "Rejected onchain: that amount is not valid here.";
  if (code === ERR.InsufficientCollateral) return "Rejected onchain: not enough collateral for that.";
  const msg = err instanceof Error ? err.message : typeof err === "string" ? err : "";
  if (/insufficient (funds|lamports)|debit an account/i.test(msg + (logs ?? []).join(" "))) return "Failed: not enough devnet SOL in your wallet.";
  if (/blockhash|expired|timeout|timed out/i.test(msg)) return "Failed: the transaction expired before it landed. Try again.";
  return "Failed. See the transaction on Explorer for details.";
}
