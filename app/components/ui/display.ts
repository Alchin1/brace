import { pct1 } from "../../lib/chart";

/** Two decimals, used only when one decimal would hide a real difference. */
export const pct2 = (bps: number): string => `${(bps / 100).toFixed(2)}%`;

/**
 * The reject card's "This borrow over Live limit" pair, from the program's own
 * bps numbers. When both round to the same one decimal string (7049 vs 7048
 * both read 70.5%), show two decimals for both so the gap is visible.
 */
export function comparePcts(ltvBps: number, limitBps: number): { ltv: string; limit: string } {
  const a = pct1(ltvBps);
  const b = pct1(limitBps);
  return a === b ? { ltv: pct2(ltvBps), limit: pct2(limitBps) } : { ltv: a, limit: b };
}

/** Below this gap (in bps on the 0 to 100% scale) the limit and liq labels would touch on a phone. */
export const SCALE_LABEL_GAP_BPS = 2000;

/** True when the LTV meter's limit label must drop to its own row to clear the liq label. */
export function scaleLabelsCollide(limitBps: number | null, liqBps: number): boolean {
  return limitBps !== null && Math.abs(liqBps - limitBps) < SCALE_LABEL_GAP_BPS;
}

/** Borrow amount after a borrow finishes: cleared once it confirms, kept for a retry if it did not. */
export function borrowTextAfter(ok: boolean, text: string): string {
  return ok ? "" : text;
}
