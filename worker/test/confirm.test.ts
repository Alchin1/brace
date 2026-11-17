import { describe, expect, test } from "vitest";
import {
  PENDING_EXPIRE_SECS,
  applySignatureStatuses,
  uniqueSigs,
  type PendingSig,
} from "../src/confirm.ts";

const a: PendingSig = { sig: "SigPack", asset: "SOL", submittedAt: 1000 };
const b: PendingSig = { sig: "SigPack", asset: "BTC", submittedAt: 1000 };
const c: PendingSig = { sig: "SigSolo", asset: "ETH", submittedAt: 1000 };

describe("applySignatureStatuses", () => {
  test("uniqueSigs keeps first-seen order", () => {
    expect(uniqueSigs([a, b, c])).toEqual(["SigPack", "SigSolo"]);
  });

  test("treats processed/confirmed/finalized as confirmed and maps one sig to every asset", () => {
    const map = new Map<string, { confirmationStatus?: string | null; err?: unknown } | null>([
      ["SigPack", { confirmationStatus: "confirmed", err: null }],
      ["SigSolo", { confirmationStatus: "processed", err: null }],
    ]);
    const out = applySignatureStatuses([a, b, c], map, 1010);
    expect(out.confirmed.map((p) => p.asset).sort()).toEqual(["BTC", "ETH", "SOL"]);
    expect(out.failed).toEqual([]);
    expect(out.pending).toEqual([]);
  });

  test("marks an on-chain err as failed for every asset sharing the sig", () => {
    const map = new Map<string, { confirmationStatus?: string | null; err?: unknown } | null>([
      ["SigPack", { confirmationStatus: "confirmed", err: { InstructionError: [2, { Custom: 6005 }] } }],
      ["SigSolo", null],
    ]);
    const out = applySignatureStatuses([a, b, c], map, 1010);
    expect(out.failed.map((p) => p.asset).sort()).toEqual(["BTC", "SOL"]);
    expect(out.failed[0].error).toContain("InstructionError");
    expect(out.pending).toEqual([c]);
    expect(out.confirmed).toEqual([]);
  });

  test("expires a still-null status after PENDING_EXPIRE_SECS and keeps younger ones pending", () => {
    const old: PendingSig = { sig: "OldSig", asset: "XRP", submittedAt: 1000 };
    const young: PendingSig = { sig: "YoungSig", asset: "ZEC", submittedAt: 1080 };
    const map = new Map<string, { confirmationStatus?: string | null; err?: unknown } | null>([
      ["OldSig", null],
      ["YoungSig", null],
    ]);
    const out = applySignatureStatuses([old, young], map, 1000 + PENDING_EXPIRE_SECS);
    expect(out.failed).toEqual([{ ...old, error: "signature expired or dropped" }]);
    expect(out.pending).toEqual([young]);
    expect(out.confirmed).toEqual([]);
  });
});
