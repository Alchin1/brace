import idl from "./idl.json";

export type Quote = {
  strikeE6: bigint;
  bidBps: number;
  askBps: number;
};

/** Parse a decimal string into an integer with `scale` fraction digits. No floats. Extra digits are truncated. */
export function decimalToScaled(s: string | null | undefined, scale: number): bigint | null {
  if (s === null || s === undefined) return null;
  const t = String(s).trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const fracPadded = (frac + "0".repeat(scale)).slice(0, scale);
  const digits = (whole + fracPadded).replace(/^0+(?=\d)/, "");
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

export function symbolBytes(symbol: string): Uint8Array {
  const out = new Uint8Array(8);
  const src = new TextEncoder().encode(symbol);
  out.set(src.subarray(0, 8));
  return out;
}

export function tickerBytes(ticker: string): Uint8Array {
  const out = new Uint8Array(32);
  const src = new TextEncoder().encode(ticker);
  out.set(src.subarray(0, 32));
  return out;
}

export function postQuotesDiscriminator(): Uint8Array {
  const ix = (idl as { instructions: { name: string; discriminator: number[] }[] }).instructions.find(
    (i) => i.name === "post_quotes",
  );
  if (!ix) throw new Error("post_quotes missing from IDL");
  return Uint8Array.from(ix.discriminator);
}

function writeU32LE(view: DataView, off: number, n: number): void {
  view.setUint32(off, n, true);
}

function writeI64LE(view: DataView, off: number, n: bigint): void {
  view.setBigInt64(off, n, true);
}

function writeU64LE(view: DataView, off: number, n: bigint): void {
  view.setBigUint64(off, n, true);
}

function writeU16LE(view: DataView, off: number, n: number): void {
  view.setUint16(off, n, true);
}

/** Borsh/Anchor layout: 8-byte discriminator + [u8;8] + i64 + [u8;32] + u64 + Vec<(u64,u16,u16)>. */
export function encodePostQuotes(args: {
  symbol: string;
  expiryTs: number;
  ticker: string;
  spotE6: bigint;
  quotes: Quote[];
}): Uint8Array {
  if (args.quotes.length > 16) throw new Error("too many quotes (max 16)");
  const disc = postQuotesDiscriminator();
  const size = 8 + 8 + 8 + 32 + 8 + 4 + args.quotes.length * 12;
  const buf = new Uint8Array(size);
  const view = new DataView(buf.buffer);
  buf.set(disc, 0);
  buf.set(symbolBytes(args.symbol), 8);
  writeI64LE(view, 16, BigInt(args.expiryTs));
  buf.set(tickerBytes(args.ticker), 24);
  writeU64LE(view, 56, args.spotE6);
  writeU32LE(view, 64, args.quotes.length);
  let off = 68;
  for (const q of args.quotes) {
    writeU64LE(view, off, q.strikeE6);
    writeU16LE(view, off + 8, q.bidBps);
    writeU16LE(view, off + 10, q.askBps);
    off += 12;
  }
  return buf;
}

export function toHex(bytes: Uint8Array): string {
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}
