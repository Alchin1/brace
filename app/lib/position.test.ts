import { describe, expect, it } from "vitest";
import { BN, BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { Keypair } from "@solana/web3.js";
import idl from "./idl.json";
import {
  POSITION_SIZE,
  collateralValueE6,
  customCode,
  decodePosition,
  failureMessage,
  formatUnits,
  ltvBps,
  maxBorrow,
  parseBlocked,
  parseUnits,
  priceFresh,
} from "./position";

describe("decodePosition", () => {
  it("matches Anchor's coder", async () => {
    const coder = new BorshAccountsCoder(idl as Idl);
    const owner = Keypair.generate().publicKey;
    const data = await coder.encode("Position", {
      owner,
      collateral_lamports: new BN("500000000"),
      debt: new BN("18446744073709551615"),
      bump: 254,
    });
    expect(data.length).toBe(POSITION_SIZE);
    expect(decodePosition(data)).toEqual({
      owner: owner.toBase58(),
      collateralLamports: 500_000_000n,
      debt: 2n ** 64n - 1n,
      bump: 254,
    });
  });

  it("rejects other accounts", () => {
    expect(() => decodePosition(new Uint8Array(POSITION_SIZE))).toThrow();
  });
});

describe("program math", () => {
  it("values collateral like collateral_value_e6", () => {
    // 0.5 SOL at $150.123456 = $75.061728
    expect(collateralValueE6(500_000_000n, 150_123_456n)).toBe(75_061_728n);
    expect(collateralValueE6(1n, 1n)).toBe(0n);
  });

  it("rounds LTV up like ltv_bps", () => {
    expect(ltvBps(0n, 0n)).toBe(0);
    expect(ltvBps(1n, 0n)).toBe(10_001);
    expect(ltvBps(50n, 100n)).toBe(5000);
    expect(ltvBps(1n, 3n)).toBe(3334);
    expect(ltvBps(69_800_001n, 100_000_000n)).toBe(6981);
  });

  it("max borrow stays inside the limit", () => {
    const value = 75_061_728n;
    const m = maxBorrow(0n, value, 6980);
    expect(ltvBps(m, value)).toBeLessThanOrEqual(6980);
    expect(ltvBps(m + 10_000n, value)).toBeGreaterThan(6980);
    expect(maxBorrow(60_000_000n, value, 5000)).toBe(0n);
  });

  it("price freshness follows MAX_PRICE_AGE_SECS", () => {
    expect(priceFresh(true, 1n, 1000n, 4600)).toBe(true);
    expect(priceFresh(true, 1n, 1000n, 4601)).toBe(false);
    expect(priceFresh(false, 1n, 1000n, 1000)).toBe(false);
    expect(priceFresh(true, 0n, 1000n, 1000)).toBe(false);
  });
});

describe("amounts", () => {
  it("parses decimal text to base units", () => {
    expect(parseUnits("0.5", 9)).toBe(500_000_000n);
    expect(parseUnits("12.345678", 6)).toBe(12_345_678n);
    expect(parseUnits("1.", 6)).toBe(1_000_000n);
    expect(parseUnits(".25", 6)).toBe(250_000n);
    expect(parseUnits("1.2345678", 6)).toBeNull();
    expect(parseUnits("0", 6)).toBeNull();
    expect(parseUnits("-1", 6)).toBeNull();
    expect(parseUnits("abc", 6)).toBeNull();
    expect(parseUnits("", 6)).toBeNull();
  });

  it("formats base units", () => {
    expect(formatUnits(1_234_567_891n, 6, 2)).toBe("1,234.56");
    expect(formatUnits(500_000_000n, 9, 3)).toBe("0.500");
    expect(formatUnits(0n, 6, 2)).toBe("0.00");
  });
});

describe("errors", () => {
  const logs = [
    "Program Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC invoke [1]",
    "Program log: Instruction: Borrow",
    "Program log: brace blocked ltv=8123 limit=6980",
    "Program log: AnchorError occurred. Error Code: RiskTightened. Error Number: 6005. Error Message: Action would exceed the current risk limit.",
  ];

  it("parses the blocked log", () => {
    expect(parseBlocked(logs)).toEqual({ ltvBps: 8123, limitBps: 6980 });
    expect(parseBlocked([])).toBeNull();
  });

  it("reads custom codes from err objects, messages and logs", () => {
    expect(customCode({ InstructionError: [1, { Custom: 6005 }] })).toBe(6005);
    expect(customCode(new Error("failed to send transaction: custom program error: 0x1779"))).toBe(6009);
    expect(customCode(null, logs)).toBe(6005);
    expect(customCode(new Error("boom"))).toBeNull();
  });

  it("maps to plain words", () => {
    expect(failureMessage({ InstructionError: [1, { Custom: 6005 }] }, logs)).toBe(
      "Rejected onchain: this borrow would put you at 81.2% against a live limit of 69.8%.",
    );
    expect(failureMessage({ InstructionError: [1, { Custom: 6009 }] }, [])).toBe(
      "Paused: the SOL price is more than an hour old, so the program blocks borrowing.",
    );
    expect(failureMessage(Object.assign(new Error("User rejected the request."), { name: "WalletSendTransactionError" }))).toBe(
      "You cancelled in your wallet.",
    );
    expect(failureMessage({ code: 4001, message: "x" })).toBe("You cancelled in your wallet.");
    expect(failureMessage(new Error("something odd"))).toBe("Failed. See the transaction on Explorer for details.");
  });
});
