// History and actions API: parsing, 24h series, and display helpers.
// The Worker contract is in docs/spec.md. /actions ltv and limit are basis points.

export const RELAYER_URL = "https://brace-relayer.ohjaye0.workers.dev";
export const HISTORY_WINDOW_SECS = 86_400;

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

export type ChartPoint = {
  ts: number;
  effectiveLtv: number;
  sigmaAnnual: number;
  tx: string;
};

export function historyUrl(asset: string, since: number, base = RELAYER_URL): string {
  const u = new URL("/history", base);
  u.searchParams.set("asset", asset);
  u.searchParams.set("since", String(since));
  return u.toString();
}

export function actionsUrl(since: number, base = RELAYER_URL): string {
  const u = new URL("/actions", base);
  u.searchParams.set("since", String(since));
  return u.toString();
}

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function asString(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

export function parseHistoryRecord(raw: unknown): HistoryRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ts = isFiniteNumber(r.ts) ? r.ts : null;
  const asset = asString(r.asset);
  const tx = asString(r.tx);
  if (ts == null || !asset || !tx) return null;
  if (
    !isFiniteNumber(r.spot) ||
    !isFiniteNumber(r.median) ||
    !isFiniteNumber(r.sigma_annual) ||
    !isFiniteNumber(r.horizon_secs) ||
    !isFiniteNumber(r.k) ||
    !isFiniteNumber(r.max_ltv) ||
    !isFiniteNumber(r.effective_ltv) ||
    !isFiniteNumber(r.points) ||
    !isFiniteNumber(r.expiry_ts) ||
    typeof r.confident !== "boolean" ||
    typeof r.ticker !== "string"
  ) {
    return null;
  }
  return {
    ts,
    asset,
    spot: r.spot,
    median: r.median,
    sigma_annual: r.sigma_annual,
    horizon_secs: r.horizon_secs,
    k: r.k,
    max_ltv: r.max_ltv,
    effective_ltv: r.effective_ltv,
    confident: r.confident,
    points: r.points,
    expiry_ts: r.expiry_ts,
    ticker: r.ticker,
    tx,
  };
}

export function parseHistory(data: unknown): HistoryRecord[] {
  if (!Array.isArray(data)) throw new Error("history response is not an array");
  return data.map(parseHistoryRecord).filter((r): r is HistoryRecord => r !== null);
}

export function parseActionRecord(raw: unknown): ActionRecord | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const ts = isFiniteNumber(r.ts) ? r.ts : null;
  const kind = asString(r.kind);
  const tx = asString(r.tx);
  if (ts == null || !kind || !tx) return null;
  if (typeof r.ok !== "boolean") return null;
  const owner = r.owner == null ? null : asString(r.owner);
  if (r.owner != null && owner == null) return null;
  const amount = r.amount == null ? null : isFiniteNumber(r.amount) ? r.amount : null;
  if (r.amount != null && amount == null) return null;
  const ltv = r.ltv == null ? null : isFiniteNumber(r.ltv) ? r.ltv : null;
  if (r.ltv != null && ltv == null) return null;
  const limit = r.limit == null ? null : isFiniteNumber(r.limit) ? r.limit : null;
  if (r.limit != null && limit == null) return null;
  const error = r.error == null ? null : asString(r.error);
  if (r.error != null && error == null) return null;
  return { ts, kind, owner, amount, ltv, limit, ok: r.ok, tx, error };
}

export function parseActions(data: unknown): ActionRecord[] {
  if (!Array.isArray(data)) throw new Error("actions response is not an array");
  return data.map(parseActionRecord).filter((r): r is ActionRecord => r !== null);
}

/** Rows inside the window, oldest first, used to draw the two series. */
export function seriesForChart(
  rows: HistoryRecord[],
  now: number,
  windowSecs = HISTORY_WINDOW_SECS,
): ChartPoint[] {
  const start = now - windowSecs;
  return rows
    .filter((r) => r.ts >= start && r.ts <= now)
    .slice()
    .sort((a, b) => a.ts - b.ts || a.tx.localeCompare(b.tx))
    .map((r) => ({
      ts: r.ts,
      effectiveLtv: r.effective_ltv,
      sigmaAnnual: r.sigma_annual,
      tx: r.tx,
    }));
}

/** Borrow and blocked-borrow rows only, newest first for the list. */
export function borrowActions(rows: ActionRecord[]): ActionRecord[] {
  return rows
    .filter((r) => r.kind === "borrow" || r.kind === "blocked")
    .slice()
    .sort((a, b) => b.ts - a.ts || a.tx.localeCompare(b.tx));
}

/** Format a basis-point LTV as a one-decimal percent, e.g. 6987 -> "69.9%". */
export function pctFromBps(bps: number): string {
  return `${(Math.round(bps / 10) / 10).toFixed(1)}%`;
}

/** Format a 0-1 ratio as a one-decimal percent, e.g. 0.6939 -> "69.4%". */
export function pctFromRatio(ratio: number): string {
  return `${(Math.round(ratio * 1000) / 10).toFixed(1)}%`;
}

export function formatUtcTime(ts: number): string {
  const d = new Date(ts * 1000);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm} UTC`;
}

export function formatUtcDateTime(ts: number): string {
  const d = new Date(ts * 1000);
  const mon = d.toLocaleString("en-US", { month: "short", timeZone: "UTC" });
  const day = d.getUTCDate();
  return `${mon} ${day}, ${formatUtcTime(ts)}`;
}

export type FormattedBorrow = {
  ts: number;
  when: string;
  label: string;
  detail: string;
  href: string;
  ok: boolean;
};

export function formatBorrowAction(row: ActionRecord): FormattedBorrow {
  const ok = row.kind === "borrow" && row.ok;
  const label = ok ? "Accepted" : "Rejected";
  const parts: string[] = [];
  if (row.ltv != null) parts.push(`${pctFromBps(row.ltv)} LTV`);
  if (row.limit != null) parts.push(`limit ${pctFromBps(row.limit)}`);
  if (row.error && !ok) parts.push(row.error);
  const detail = parts.length ? parts.join(", ") : ok ? "Borrow under the live limit" : "Borrow rejected onchain";
  return {
    ts: row.ts,
    when: formatUtcDateTime(row.ts),
    label,
    detail,
    href: explorerTx(row.tx),
    ok,
  };
}

export function linePath(points: { x: number; y: number }[]): string {
  if (!points.length) return "";
  return points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join("");
}

/** Inclusive time ticks at a whole-hour step that covers [t0, t1]. */
export function timeTicks(t0: number, t1: number, maxTicks = 6): number[] {
  if (!(t1 > t0)) return [t0];
  const span = t1 - t0;
  const hour = 3600;
  const stepHours = [1, 2, 3, 4, 6, 8, 12, 24].find((h) => span / (h * hour) <= maxTicks) ?? 24;
  const step = stepHours * hour;
  const start = Math.ceil(t0 / step) * step;
  const out: number[] = [];
  for (let t = start; t <= t1 + 1e-6; t += step) out.push(t);
  return out.length ? out : [t0, t1];
}

/** Padded numeric domain. Ratios stay inside [0, loft]. */
export function paddedDomain(
  values: number[],
  loft: number,
  fallback: [number, number],
  minSpan = 0,
): { min: number; max: number } {
  const finite = values.filter((v) => Number.isFinite(v));
  if (!finite.length) return { min: fallback[0], max: fallback[1] };
  let min = Math.min(...finite);
  let max = Math.max(...finite);
  if (max === min) {
    const pad = Math.max(minSpan / 2, 0.05);
    min -= pad;
    max += pad;
  } else {
    const pad = (max - min) * 0.12;
    min -= pad;
    max += pad;
  }
  if (max - min < minSpan) {
    const mid = (min + max) / 2;
    min = mid - minSpan / 2;
    max = mid + minSpan / 2;
  }
  min = Math.max(0, min);
  max = Math.min(loft, max);
  if (!(max > min)) return { min: fallback[0], max: fallback[1] };
  return { min, max };
}
