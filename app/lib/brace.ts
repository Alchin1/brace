// Brace program: PDA derivation, account decoding and the stale step-down rule.
// Decoding is done by hand from the IDL layout (programs/brace/src/state.rs);
// lib/brace.test.ts checks it byte-for-byte against Anchor's IDL coder.

import { Connection, PublicKey } from "@solana/web3.js";

export const PROGRAM_ID = new PublicKey("Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC");
export const SYMBOLS = ["SOL", "BTC", "ETH", "ZEC", "XRP"] as const;
export type Symbol = (typeof SYMBOLS)[number];

export const DEFAULT_RPC = "https://api.devnet.solana.com";
export const REPO_URL = "https://github.com/ohjay-official/brace";

// Anchor account discriminators, from target/idl/brace.json.
export const FEED_DISCRIMINATOR = [69, 191, 16, 227, 132, 187, 84, 227];
export const CONFIG_DISCRIMINATOR = [155, 12, 170, 224, 30, 250, 204, 130];

export function explorerAddress(address: string): string {
  return `https://explorer.solana.com/address/${address}?cluster=devnet`;
}

export function isSymbol(s: string): s is Symbol {
  return (SYMBOLS as readonly string[]).includes(s);
}

/** ASCII symbol, zero-padded to 8 bytes. */
export function symbol8(symbol: string): Uint8Array {
  const out = new Uint8Array(8);
  for (let i = 0; i < symbol.length && i < 8; i++) out[i] = symbol.charCodeAt(i);
  return out;
}

export function feedPda(symbol: string, programId: PublicKey = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("feed"), symbol8(symbol)], programId)[0];
}

export function configPda(programId: PublicKey = PROGRAM_ID): PublicKey {
  return PublicKey.findProgramAddressSync([new TextEncoder().encode("config")], programId)[0];
}

export interface Params {
  govMaxLtvBps: number;
  liqThresholdBps: number;
  horizonSecs: number;
  kX100: number;
  absFloorLtvBps: number;
  staleSecs: number;
  staleStepBps: number;
  staleFloorLtvBps: number;
  maxSpreadBps: number;
  minPoints: number;
  minExpirySecs: number;
  maxExpirySecs: number;
  maxSpotGapBps: number;
}

export interface Config {
  admin: string;
  relayer: string;
  params: Params;
  bump: number;
}

export interface Feed {
  symbol: string;
  spotE6: bigint;
  medianE6: bigint;
  sigmaBps: bigint;
  horizonMoveE6: bigint;
  points: number;
  expiryTs: bigint;
  ticker: string;
  confident: boolean;
  maxLtvBps: number;
  hasValid: boolean;
  lastValidAt: bigint;
  postedAt: bigint;
  bump: number;
}

class Reader {
  private view: DataView;
  off = 0;
  constructor(private bytes: Uint8Array) {
    this.view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  }
  need(n: number) {
    if (this.off + n > this.bytes.length) throw new Error("account data too short");
  }
  u8() { this.need(1); return this.view.getUint8(this.off++); }
  bool() { return this.u8() !== 0; }
  u16() { this.need(2); const v = this.view.getUint16(this.off, true); this.off += 2; return v; }
  u32() { this.need(4); const v = this.view.getUint32(this.off, true); this.off += 4; return v; }
  u64() { this.need(8); const v = this.view.getBigUint64(this.off, true); this.off += 8; return v; }
  i64() { this.need(8); const v = this.view.getBigInt64(this.off, true); this.off += 8; return v; }
  bytesN(n: number) { this.need(n); const v = this.bytes.subarray(this.off, this.off + n); this.off += n; return v; }
  pubkey() { return new PublicKey(this.bytesN(32)).toBase58(); }
}

function checkDiscriminator(r: Reader, want: number[], name: string) {
  const got = r.bytesN(8);
  for (let i = 0; i < 8; i++) {
    if (got[i] !== want[i]) throw new Error(`not a ${name} account`);
  }
}

/** Zero-padded ASCII bytes to a string. */
export function asciiZ(bytes: Uint8Array): string {
  let s = "";
  for (const b of bytes) {
    if (b === 0) break;
    s += String.fromCharCode(b);
  }
  return s;
}

export function decodeFeed(data: Uint8Array): Feed {
  const r = new Reader(data);
  checkDiscriminator(r, FEED_DISCRIMINATOR, "Feed");
  return {
    symbol: asciiZ(r.bytesN(8)),
    spotE6: r.u64(),
    medianE6: r.u64(),
    sigmaBps: r.u64(),
    horizonMoveE6: r.u64(),
    points: r.u8(),
    expiryTs: r.i64(),
    ticker: asciiZ(r.bytesN(32)),
    confident: r.bool(),
    maxLtvBps: r.u16(),
    hasValid: r.bool(),
    lastValidAt: r.i64(),
    postedAt: r.i64(),
    bump: r.u8(),
  };
}

export function decodeConfig(data: Uint8Array): Config {
  const r = new Reader(data);
  checkDiscriminator(r, CONFIG_DISCRIMINATOR, "Config");
  const admin = r.pubkey();
  const relayer = r.pubkey();
  const params: Params = {
    govMaxLtvBps: r.u16(),
    liqThresholdBps: r.u16(),
    horizonSecs: r.u32(),
    kX100: r.u16(),
    absFloorLtvBps: r.u16(),
    staleSecs: r.u32(),
    staleStepBps: r.u16(),
    staleFloorLtvBps: r.u16(),
    maxSpreadBps: r.u16(),
    minPoints: r.u8(),
    minExpirySecs: r.u32(),
    maxExpirySecs: r.u32(),
    maxSpotGapBps: r.u16(),
  };
  return { admin, relayer, params, bump: r.u8() };
}

/**
 * Port of math.rs effective_limit_bps. Max LTV with staleness decay: steps down by
 * stale_step per stale period, never below min(stale_floor, base), never above
 * base = min(max_ltv, gov_max).
 */
export function effectiveLimitBps(
  hasValid: boolean,
  maxLtvBps: number,
  lastValidAt: bigint | number,
  now: bigint | number,
  staleSecs: number,
  staleStepBps: number,
  staleFloorBps: number,
  govMaxBps: number,
): number {
  if (!hasValid) return Math.min(staleFloorBps, govMaxBps);
  const base = Math.min(maxLtvBps, govMaxBps);
  let age = BigInt(now) - BigInt(lastValidAt);
  if (age < 0n) age = 0n;
  if (age <= BigInt(staleSecs)) return base;
  if (staleSecs === 0) return Math.min(staleFloorBps, base);
  const drop = (age / BigInt(staleSecs)) * BigInt(staleStepBps);
  const stepped = drop >= BigInt(base) ? 0 : base - Number(drop);
  return Math.max(stepped, Math.min(staleFloorBps, base));
}

export function feedEffectiveLtvBps(feed: Feed, p: Params, now: bigint | number): number {
  return effectiveLimitBps(
    feed.hasValid,
    feed.maxLtvBps,
    feed.lastValidAt,
    now,
    p.staleSecs,
    p.staleStepBps,
    p.staleFloorLtvBps,
    p.govMaxLtvBps,
  );
}

export type FeedStatus = "live" | "stale" | "none";

/** Live: confident and the last valid post is within stale_secs. */
export function feedStatus(feed: Feed | null, p: Params, now: bigint | number): FeedStatus {
  if (!feed) return "none";
  const age = BigInt(now) - feed.lastValidAt;
  if (feed.confident && feed.hasValid && age <= BigInt(p.staleSecs)) return "live";
  return "stale";
}

export type BoardState =
  | { kind: "error"; message: string }
  | { kind: "not-deployed" }
  | { kind: "not-initialized" }
  | { kind: "ok"; config: Config; feeds: Record<Symbol, Feed | null>; fetchedAt: number };

/** One RPC call: program account, Config and every Feed. */
export async function fetchBoard(rpcUrl: string): Promise<BoardState> {
  const conn = new Connection(rpcUrl, "confirmed");
  const keys = [PROGRAM_ID, configPda(), ...SYMBOLS.map((s) => feedPda(s))];
  let infos;
  try {
    infos = await conn.getMultipleAccountsInfo(keys);
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
  const [program, config, ...feedInfos] = infos;
  if (!program || !program.executable) return { kind: "not-deployed" };
  if (!config || !config.owner.equals(PROGRAM_ID)) return { kind: "not-initialized" };
  const feeds = {} as Record<Symbol, Feed | null>;
  SYMBOLS.forEach((s, i) => {
    const info = feedInfos[i];
    if (!info || !info.owner.equals(PROGRAM_ID)) {
      feeds[s] = null;
      return;
    }
    try {
      feeds[s] = decodeFeed(info.data);
    } catch {
      feeds[s] = null;
    }
  });
  try {
    return { kind: "ok", config: decodeConfig(config.data), feeds, fetchedAt: Date.now() };
  } catch (e) {
    return { kind: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

// Formatting helpers (pure, tested where it matters).

export function pctFromBps(bps: number | bigint, digits = 2): string {
  return `${(Number(bps) / 100).toFixed(digits)}%`;
}

export function fromE6(v: bigint, digits = 2): string {
  const n = Number(v) / 1e6;
  return n.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function relTime(secs: number): string {
  const s = Math.max(0, Math.floor(secs));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function untilTime(secs: number): string {
  if (secs <= 0) return "expired";
  const s = Math.floor(secs);
  if (s < 3600) return `in ${Math.floor(s / 60)}m`;
  if (s < 86400) return `in ${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `in ${Math.floor(s / 86400)}d ${Math.floor((s % 86400) / 3600)}h`;
}
