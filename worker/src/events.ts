import { PublicKey } from "@solana/web3.js";
import { symbolBytes, tickerBytes } from "./encode.ts";

/** Default Params (horizon_secs, k_x100) are not in the QuotesPosted event. */
export const DEFAULT_HORIZON_SECS = 86_400;
export const DEFAULT_K_X100 = 300;

export const EVENT_DISCRIMINATORS: Record<string, number[]> = {
  QuotesPosted: [39, 212, 123, 63, 249, 118, 82, 66],
  Deposited: [111, 141, 26, 45, 161, 35, 100, 57],
  Borrowed: [225, 182, 241, 78, 34, 145, 253, 230],
  Repaid: [38, 248, 231, 7, 150, 164, 172, 23],
  Withdrawn: [20, 89, 223, 198, 194, 124, 219, 13],
  Liquidated: [231, 57, 55, 75, 0, 170, 246, 68],
};

export type QuotesPostedEvent = {
  name: "QuotesPosted";
  symbol: string;
  confident: boolean;
  sigmaBps: number;
  maxLtvBps: number;
  effectiveLtvBps: number;
  spotE6: bigint;
  medianE6: bigint;
  points: number;
  expiryTs: bigint;
  ticker: string;
  postedAt: bigint;
};

export type DepositedEvent = { name: "Deposited"; owner: string; lamports: bigint };
export type BorrowedEvent = { name: "Borrowed"; owner: string; amount: bigint; ltvBps: bigint; limitBps: number };
export type RepaidEvent = { name: "Repaid"; owner: string; amount: bigint };
export type WithdrawnEvent = { name: "Withdrawn"; owner: string; lamports: bigint };
export type LiquidatedEvent = { name: "Liquidated"; owner: string; liquidator: string; debt: bigint; seized: bigint };
export type BraceEvent =
  | QuotesPostedEvent
  | DepositedEvent
  | BorrowedEvent
  | RepaidEvent
  | WithdrawnEvent
  | LiquidatedEvent;

function discKey(bytes: Uint8Array): string {
  return Array.from(bytes).join(",");
}

const DISC_BY_KEY = new Map<string, string>(
  Object.entries(EVENT_DISCRIMINATORS).map(([name, d]) => [d.join(","), name]),
);

function padUtf8(bytes: Uint8Array): string {
  let end = bytes.length;
  while (end > 0 && bytes[end - 1] === 0) end--;
  return new TextDecoder().decode(bytes.subarray(0, end));
}

class Cursor {
  constructor(
    private buf: Uint8Array,
    private i = 0,
  ) {}
  remaining(): number {
    return this.buf.length - this.i;
  }
  u8(): number {
    if (this.i >= this.buf.length) throw new Error("event buffer underrun");
    return this.buf[this.i++];
  }
  bytes(n: number): Uint8Array {
    if (this.i + n > this.buf.length) throw new Error("event buffer underrun");
    const slice = this.buf.subarray(this.i, this.i + n);
    this.i += n;
    return slice;
  }
  bool(): boolean {
    return this.u8() !== 0;
  }
  u16(): number {
    const b = this.bytes(2);
    return b[0] | (b[1] << 8);
  }
  u64(): bigint {
    const b = this.bytes(8);
    let v = 0n;
    for (let i = 7; i >= 0; i--) v = (v << 8n) | BigInt(b[i]);
    return v;
  }
  i64(): bigint {
    const v = this.u64();
    return v >= 1n << 63n ? v - (1n << 64n) : v;
  }
  pubkey(): string {
    return new PublicKey(this.bytes(32)).toBase58();
  }
}

export function decodeEventPayload(buf: Uint8Array): BraceEvent | null {
  if (buf.length < 8) return null;
  const name = DISC_BY_KEY.get(discKey(buf.subarray(0, 8)));
  if (!name) return null;
  const c = new Cursor(buf, 8);
  try {
    switch (name) {
      case "QuotesPosted":
        return {
          name,
          symbol: padUtf8(c.bytes(8)),
          confident: c.bool(),
          sigmaBps: Number(c.u64()),
          maxLtvBps: c.u16(),
          effectiveLtvBps: c.u16(),
          spotE6: c.u64(),
          medianE6: c.u64(),
          points: c.u8(),
          expiryTs: c.i64(),
          ticker: padUtf8(c.bytes(32)),
          postedAt: c.i64(),
        };
      case "Deposited":
        return { name, owner: c.pubkey(), lamports: c.u64() };
      case "Borrowed":
        return { name, owner: c.pubkey(), amount: c.u64(), ltvBps: c.u64(), limitBps: c.u16() };
      case "Repaid":
        return { name, owner: c.pubkey(), amount: c.u64() };
      case "Withdrawn":
        return { name, owner: c.pubkey(), lamports: c.u64() };
      case "Liquidated":
        return { name, owner: c.pubkey(), liquidator: c.pubkey(), debt: c.u64(), seized: c.u64() };
      default:
        return null;
    }
  } catch {
    return null;
  }
}

export function eventsFromLogs(logs: string[]): BraceEvent[] {
  const out: BraceEvent[] = [];
  for (const line of logs) {
    const prefix = "Program data: ";
    const idx = line.indexOf(prefix);
    if (idx < 0) continue;
    const b64 = line.slice(idx + prefix.length).trim();
    try {
      const raw = Uint8Array.from(atob(b64), (ch) => ch.charCodeAt(0));
      const ev = decodeEventPayload(raw);
      if (ev) out.push(ev);
    } catch {
      // skip malformed log lines
    }
  }
  return out;
}

export function encodeEvent(ev: BraceEvent): Uint8Array {
  const parts: Uint8Array[] = [];
  const disc = EVENT_DISCRIMINATORS[ev.name];
  parts.push(Uint8Array.from(disc));
  const u8 = (n: number) => Uint8Array.of(n);
  const u16 = (n: number) => Uint8Array.of(n & 0xff, (n >> 8) & 0xff);
  const u64 = (n: bigint) => {
    const b = new Uint8Array(8);
    let v = n < 0n ? n + (1n << 64n) : n;
    for (let i = 0; i < 8; i++) {
      b[i] = Number(v & 0xffn);
      v >>= 8n;
    }
    return b;
  };
  const pk = (s: string) => new PublicKey(s).toBytes();
  switch (ev.name) {
    case "QuotesPosted":
      parts.push(symbolBytes(ev.symbol), u8(ev.confident ? 1 : 0), u64(BigInt(ev.sigmaBps)), u16(ev.maxLtvBps), u16(ev.effectiveLtvBps), u64(ev.spotE6), u64(ev.medianE6), u8(ev.points), u64(ev.expiryTs), tickerBytes(ev.ticker), u64(ev.postedAt));
      break;
    case "Deposited":
      parts.push(pk(ev.owner), u64(ev.lamports));
      break;
    case "Borrowed":
      parts.push(pk(ev.owner), u64(ev.amount), u64(ev.ltvBps), u16(ev.limitBps));
      break;
    case "Repaid":
      parts.push(pk(ev.owner), u64(ev.amount));
      break;
    case "Withdrawn":
      parts.push(pk(ev.owner), u64(ev.lamports));
      break;
    case "Liquidated":
      parts.push(pk(ev.owner), pk(ev.liquidator), u64(ev.debt), u64(ev.seized));
      break;
  }
  let len = 0;
  for (const p of parts) len += p.length;
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

export function programDataLog(ev: BraceEvent): string {
  const raw = encodeEvent(ev);
  let bin = "";
  for (const b of raw) bin += String.fromCharCode(b);
  return "Program data: " + btoa(bin);
}
