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

export async function historyResponse(
  store: BraceStore,
  asset: string | undefined,
  since: number | undefined,
): Promise<HistoryRecord[]> {
  const rows = await store.listPosts(asset, since);
  return rows.map(toHistoryRecord);
}

export async function actionsResponse(store: BraceStore, since: number | undefined): Promise<ActionRecord[]> {
  const rows = await store.listActions(since);
  return rows.map(toActionRecord);
}

export function parseSince(raw: string | null): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n)) return undefined;
  return Math.trunc(n);
}
