import { describe, expect, it } from "vitest";
import { BN, BorshAccountsCoder, type Idl } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import idl from "./idl.json";
import {
  PROGRAM_ID,
  SYMBOLS,
  configPda,
  decodeConfig,
  decodeFeed,
  effectiveLimitBps,
  feedEffectiveLtvBps,
  feedPda,
  feedStatus,
  symbol8,
} from "./brace";

const I64_MIN = -(2n ** 63n);
const I64_MAX = 2n ** 63n - 1n;
const coder = new BorshAccountsCoder(idl as Idl);

const params = {
  govMaxLtvBps: 7500,
  liqThresholdBps: 8000,
  horizonSecs: 86_400,
  kX100: 300,
  absFloorLtvBps: 3000,
  staleSecs: 300,
  staleStepBps: 250,
  staleFloorLtvBps: 5000,
  maxSpreadBps: 1500,
  minPoints: 3,
  minExpirySecs: 900,
  maxExpirySecs: 259_200,
  maxSpotGapBps: 300,
};

function pad(s: string, n: number): number[] {
  const out = new Array(n).fill(0);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

describe("PDA derivation", () => {
  it("matches findProgramAddressSync with Buffer seeds", () => {
    expect(PROGRAM_ID.toBase58()).toBe((idl as { address: string }).address);
    for (const s of SYMBOLS) {
      const sym = Buffer.alloc(8);
      sym.write(s, "ascii");
      const [want] = PublicKey.findProgramAddressSync([Buffer.from("feed"), sym], PROGRAM_ID);
      expect(feedPda(s).toBase58()).toBe(want.toBase58());
    }
    const [cfg] = PublicKey.findProgramAddressSync([Buffer.from("config")], PROGRAM_ID);
    expect(configPda().toBase58()).toBe(cfg.toBase58());
  });

  it("zero-pads symbols to 8 bytes", () => {
    expect(Array.from(symbol8("SOL"))).toEqual([83, 79, 76, 0, 0, 0, 0, 0]);
  });
});

describe("effectiveLimitBps (same cases as math.rs effective_limit_cases)", () => {
  it("not valid yet: stale floor", () => {
    expect(effectiveLimitBps(false, 7000, 0, 1000, 300, 250, 5000, 7500)).toBe(5000);
  });
  it("fresh", () => {
    expect(effectiveLimitBps(true, 7000, 1000, 1100, 300, 250, 5000, 7500)).toBe(7000);
  });
  it("stepped: age 650 is 2 steps of 250", () => {
    expect(effectiveLimitBps(true, 7000, 1000, 1650, 300, 250, 5000, 7500)).toBe(6500);
  });
  it("floor: very old", () => {
    expect(effectiveLimitBps(true, 7000, 0, 1_000_000_000, 300, 250, 5000, 7500)).toBe(5000);
  });
  it("never above last limit: max_ltv below stale floor is never raised", () => {
    expect(effectiveLimitBps(true, 4000, 0, 1_000_000, 300, 250, 5000, 7500)).toBe(4000);
  });
  it("never above gov max", () => {
    expect(effectiveLimitBps(true, 9000, 1000, 1100, 300, 250, 5000, 7500)).toBe(7500);
  });
  it("stale_secs 0", () => {
    expect(effectiveLimitBps(true, 7000, 1000, 1001, 0, 250, 5000, 7500)).toBe(5000);
  });
  it("extreme times", () => {
    expect(effectiveLimitBps(true, 7000, I64_MIN, I64_MAX, 1, 65535, 5000, 7500)).toBe(5000);
    expect(effectiveLimitBps(true, 7000, I64_MAX, I64_MIN, 1, 250, 5000, 7500)).toBe(7000);
  });
  it("properties: <= gov, <= base, non-increasing in now", () => {
    let x = 0x9e3779b97f4a7c15n;
    const next = () => {
      x ^= (x << 13n) & 0xffffffffffffffffn;
      x ^= x >> 7n;
      x ^= (x << 17n) & 0xffffffffffffffffn;
      return x;
    };
    const u16 = () => Number(next() & 0xffffn);
    for (let i = 0; i < 2000; i++) {
      const hasValid = (next() & 1n) === 1n;
      const maxLtv = u16() % 12000;
      const gov = u16() % 12000;
      const floor = u16() % 12000;
      const step = u16() % 2000;
      const stale = Number(next() % 2000n);
      const last = Number(next() % 1_000_000n) - 500_000;
      let now = Number(next() % 2_000_000n) - 1_000_000;
      let prev = effectiveLimitBps(hasValid, maxLtv, last, now, stale, step, floor, gov);
      expect(prev).toBeLessThanOrEqual(gov);
      if (hasValid) expect(prev).toBeLessThanOrEqual(Math.min(maxLtv, gov));
      for (let j = 0; j < 10; j++) {
        now += Number(next() % 500n);
        const cur = effectiveLimitBps(hasValid, maxLtv, last, now, stale, step, floor, gov);
        expect(cur).toBeLessThanOrEqual(prev);
        prev = cur;
      }
    }
  });
});

describe("decoding", () => {
  it("decodes a Feed encoded by Anchor's IDL coder", async () => {
    const buf = await coder.encode("Feed", {
      symbol: pad("SOL", 8),
      spot_e6: new BN("71789100"),
      median_e6: new BN("71800000"),
      sigma_bps: new BN(8651),
      horizon_move_e6: new BN(45678),
      points: 8,
      expiry_ts: new BN("1763395200"),
      ticker: pad("SOL2511171700", 32),
      confident: true,
      max_ltv_bps: 6913,
      has_valid: true,
      last_valid_at: new BN("1763340000"),
      posted_at: new BN("1763340060"),
      bump: 254,
    });
    const f = decodeFeed(new Uint8Array(buf));
    expect(f).toEqual({
      symbol: "SOL",
      spotE6: 71789100n,
      medianE6: 71800000n,
      sigmaBps: 8651n,
      horizonMoveE6: 45678n,
      points: 8,
      expiryTs: 1763395200n,
      ticker: "SOL2511171700",
      confident: true,
      maxLtvBps: 6913,
      hasValid: true,
      lastValidAt: 1763340000n,
      postedAt: 1763340060n,
      bump: 254,
    });
    // Effective LTV and status from the decoded feed.
    expect(feedEffectiveLtvBps(f, params, 1763340100)).toBe(6913);
    expect(feedStatus(f, params, 1763340100)).toBe("live");
    expect(feedEffectiveLtvBps(f, params, 1763340000 + 650)).toBe(6413);
    expect(feedStatus(f, params, 1763340000 + 650)).toBe("stale");
    expect(feedStatus(null, params, 0)).toBe("none");
    expect(feedStatus({ ...f, confident: false }, params, 1763340100)).toBe("stale");
  });

  it("decodes a Config encoded by Anchor's IDL coder", async () => {
    const admin = new PublicKey(new Uint8Array(32).fill(7));
    const relayer = PROGRAM_ID;
    const buf = await coder.encode("Config", {
      admin,
      relayer,
      params: {
        gov_max_ltv_bps: 7500,
        liq_threshold_bps: 8000,
        horizon_secs: 86400,
        k_x100: 300,
        abs_floor_ltv_bps: 3000,
        stale_secs: 300,
        stale_step_bps: 250,
        stale_floor_ltv_bps: 5000,
        max_spread_bps: 1500,
        min_points: 3,
        min_expiry_secs: 900,
        max_expiry_secs: 259200,
        max_spot_gap_bps: 300,
      },
      bump: 255,
    });
    const c = decodeConfig(new Uint8Array(buf));
    expect(c).toEqual({ admin: admin.toBase58(), relayer: relayer.toBase58(), params, bump: 255 });
  });

  it("rejects the wrong discriminator and short data", () => {
    expect(() => decodeFeed(new Uint8Array(200))).toThrow(/not a Feed/);
    expect(() => decodeConfig(new Uint8Array(4))).toThrow();
  });
});
