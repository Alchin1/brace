import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, test } from "vitest";
import {
  decimalToScaled,
  encodePostQuotes,
  postQuotesDiscriminator,
  symbolBytes,
  tickerBytes,
  toHex,
} from "../src/encode.ts";
import twoQuote from "./fixtures/two-quote-ix.json";

const root = dirname(fileURLToPath(import.meta.url));

describe("decimalToScaled", () => {
  test("handover examples and live pubticker strings", () => {
    expect(decimalToScaled("71.5", 6)).toBe(71_500_000n);
    expect(decimalToScaled("0.44", 4)).toBe(4400n);
    expect(decimalToScaled("0.9589700", 6)).toBe(958_970n);
    expect(decimalToScaled("64602.60000", 6)).toBe(64_602_600_000n);
    expect(decimalToScaled("72.17900", 6)).toBe(72_179_000n);
    expect(decimalToScaled("72", 6)).toBe(72_000_000n);
    expect(decimalToScaled("0.90", 6)).toBe(900_000n);
    expect(decimalToScaled("0.7", 6)).toBe(700_000n);
  });

  test("truncates extra fraction digits and rejects junk", () => {
    expect(decimalToScaled("1.2345678", 6)).toBe(1_234_567n);
    expect(decimalToScaled("00.44", 4)).toBe(4400n);
    expect(decimalToScaled("", 6)).toBeNull();
    expect(decimalToScaled(null, 6)).toBeNull();
    expect(decimalToScaled("abc", 6)).toBeNull();
    expect(decimalToScaled("-1", 6)).toBeNull();
  });
});

describe("padding", () => {
  test("symbol and ticker are zero-padded / truncated", () => {
    expect(Array.from(symbolBytes("SOL"))).toEqual([83, 79, 76, 0, 0, 0, 0, 0]);
    expect(Array.from(symbolBytes("BTC"))).toEqual([66, 84, 67, 0, 0, 0, 0, 0]);
    const t = tickerBytes("SOL2611162200");
    expect(t.length).toBe(32);
    expect(new TextDecoder().decode(t.subarray(0, 13))).toBe("SOL2611162200");
    expect(Array.from(t.subarray(13))).toEqual(Array(19).fill(0));
    expect(tickerBytes("X".repeat(40)).length).toBe(32);
  });
});

describe("post_quotes encoding vs IDL", () => {
  test("discriminator matches worker/src/idl.json", () => {
    const idl = JSON.parse(readFileSync(join(root, "../src/idl.json"), "utf8"));
    const disc = idl.instructions.find((i: { name: string }) => i.name === "post_quotes").discriminator;
    expect(Array.from(postQuotesDiscriminator())).toEqual(disc);
  });

  test("2-quote case has the exact IDL byte layout", () => {
    const data = encodePostQuotes({
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
    expect(toHex(data)).toBe(twoQuote.dataHex);
    expect(data.length).toBe(8 + 8 + 8 + 32 + 8 + 4 + 2 * 12);
  });
});
