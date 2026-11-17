import { bpsToRatio, e6ToNumber, kToNumber } from "./scale.ts";
import type { ActionRow, BraceStore, PostRow } from "./store.ts";

/** Accuracy-tracker contract from docs/spec.md and docs/sample-history.json. */
export type HistoryRecord = {
  ts: number;
  asset: string;
  spot: number;
  median: number;
  sigma_annual: number;
  horizon_secs: number;
  k: number;
  max_ltv: number;
  effective_ltv: number;
  confident: boolean;
  points: number;
  expiry_ts: number;
  ticker: string;
  tx: string;
};

export type ActionRecord = {
  ts: number;
  kind: string;
  owner: string | null;
  amount: number | null;
  ltv: number | null;
  limit: number | null;
  ok: boolean;
  tx: string;
  error: string | null;
};

export function toHistoryRecord(row: PostRow): HistoryRecord {
  return {
    ts: row.ts,
    asset: row.asset,
    spot: e6ToNumber(row.spot_e6),
    median: e6ToNumber(row.median_e6),
    sigma_annual: bpsToRatio(row.sigma_bps),
    horizon_secs: row.horizon_secs,
    k: kToNumber(row.k_x100),
    max_ltv: bpsToRatio(row.max_ltv_bps),
    effective_ltv: bpsToRatio(row.effective_ltv_bps),
    confident: row.confident !== 0,
    points: row.points,
    expiry_ts: row.expiry_ts,
    ticker: row.ticker,
    tx: row.tx,
  };
}

export function toActionRecord(row: ActionRow): ActionRecord {
  return {
    ts: row.ts,
    kind: row.kind,
    owner: row.owner,
    amount: row.amount,
    ltv: row.ltv,
    limit: row.limit,
    ok: row.ok !== 0,
    tx: row.tx,
    error: row.error,
  };
}

/** Most rows one /history or /actions response returns (about 2 MB). Page forward with since=. */
export const MAX_ROWS = 10_000;

/**
 * Rows are always oldest first. With since, the oldest `limit` rows at or after since (page forward
 * by passing the last ts as the next since). Without since, the newest `limit` rows.
 */
function window<T>(rows: T[], since: number | undefined, limit: number): T[] {
  if (rows.length <= limit) return rows;
  return since !== undefined ? rows.slice(0, limit) : rows.slice(rows.length - limit);
}

export async function historyResponse(
  store: BraceStore,
  asset: string | undefined,
  since: number | undefined,
  limit: number = MAX_ROWS,
): Promise<HistoryRecord[]> {
  const rows = await store.listPosts(asset, since, limit);
  return window(rows, since, limit).map(toHistoryRecord);
}

export async function actionsResponse(
  store: BraceStore,
  since: number | undefined,
  limit: number = MAX_ROWS,
): Promise<ActionRecord[]> {
  const rows = await store.listActions(since, limit);
  return window(rows, since, limit).map(toActionRecord);
}

/** Lenient parse kept for callers that only need a number or nothing. */
export function parseSince(raw: string | null): number | undefined {
  const r = parseSinceStrict(raw);
  return r.ok ? r.value : undefined;
}

export type Parsed<T> = { ok: true; value: T } | { ok: false; error: string };

/** since must be empty/absent or non-negative unix seconds. */
export function parseSinceStrict(raw: string | null): Parsed<number | undefined> {
  if (raw == null || raw === "") return { ok: true, value: undefined };
  if (!/^\d{1,12}(\.\d+)?$/.test(raw.trim())) return { ok: false, error: "since must be unix seconds (a non-negative number)" };
  return { ok: true, value: Math.trunc(Number(raw)) };
}

export function parseLimit(raw: string | null): Parsed<number> {
  if (raw == null || raw === "") return { ok: true, value: MAX_ROWS };
  if (!/^\d{1,6}$/.test(raw.trim())) return { ok: false, error: `limit must be a whole number from 1 to ${MAX_ROWS}` };
  const n = Number(raw);
  if (n < 1 || n > MAX_ROWS) return { ok: false, error: `limit must be a whole number from 1 to ${MAX_ROWS}` };
  return { ok: true, value: n };
}
