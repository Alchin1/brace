import { ASSETS } from "./assets.ts";
import type { PendingSig } from "./confirm.ts";
export type PostRow = {
  tx: string;
  asset: string;
  ts: number;
  spot_e6: number;
  median_e6: number;
  sigma_bps: number;
  horizon_secs: number;
  k_x100: number;
  max_ltv_bps: number;
  effective_ltv_bps: number;
  confident: number;
  points: number;
  expiry_ts: number;
  ticker: string;
};

export type ActionRow = {
  tx: string;
  kind: string;
  ts: number;
  owner: string | null;
  amount: number | null;
  ltv: number | null;
  limit: number | null;
  ok: number;
  error: string | null;
};

export type RelayerAssetState = {
  asset: string;
  lastSig: string | null;
  lastAt: number | null;
  lastError: string | null;
};

export type RelayerRunState = {
  lastRun: string | null;
  lastError: string | null;
  assets: RelayerAssetState[];
};

export type FeedHealth = {
  lastSig: string | null;
  lastPostTs: number | null;
  ageSecs: number | null;
  lastError: string | null;
};

export type HealthReport = {
  ok: boolean;
  lastRun: string | null;
  lastError: string | null;
  lastSigs: Record<string, string>;
  feeds: Record<string, FeedHealth>;
};

export interface BraceStore {
  upsertPost(row: PostRow): Promise<void>;
  upsertAction(row: ActionRow): Promise<void>;
  /** Oldest first. With since: the first `limit` rows from since. Without: the newest `limit` rows. */
  listPosts(asset: string | undefined, since: number | undefined, limit?: number): Promise<PostRow[]>;
  listActions(since: number | undefined, limit?: number): Promise<ActionRow[]>;
  /** prev is the state loaded before this run; a store may skip rows that did not change. */
  saveRelayerRun(state: RelayerRunState, prev?: RelayerRunState): Promise<void>;
  loadRelayerRun(): Promise<RelayerRunState>;
  latestPostTsByAsset(): Promise<Record<string, number>>;
  listPendingSigs(): Promise<PendingSig[]>;
  addPendingSigs(rows: PendingSig[]): Promise<void>;
  removePendingSigs(rows: { sig: string; asset: string }[]): Promise<void>;
}

export function buildHealthReport(run: RelayerRunState, latestPosts: Record<string, number>, nowSeconds: number): HealthReport {
  const lastSigs: Record<string, string> = {};
  const feeds: Record<string, FeedHealth> = {};
  const assets = new Set<string>([...run.assets.map((a) => a.asset), ...Object.keys(latestPosts)]);
  for (const asset of [...assets].sort()) {
    const row = run.assets.find((a) => a.asset === asset);
    if (row?.lastSig) lastSigs[asset] = row.lastSig;
    const lastPostTs = latestPosts[asset] ?? row?.lastAt ?? null;
    feeds[asset] = {
      lastSig: row?.lastSig ?? null,
      lastPostTs,
      ageSecs: lastPostTs != null ? Math.max(0, nowSeconds - lastPostTs) : null,
      lastError: row?.lastError ?? null,
    };
  }
  return {
    ok: true,
    lastRun: run.lastRun,
    lastError: run.lastError,
    lastSigs,
    feeds,
  };
}

export class MemoryStore implements BraceStore {
  posts: PostRow[] = [];
  actions: ActionRow[] = [];
  run: RelayerRunState = { lastRun: null, lastError: null, assets: [] };
  pending: PendingSig[] = [];

  async upsertPost(row: PostRow): Promise<void> {
    this.posts = this.posts.filter((p) => !(p.tx === row.tx && p.asset === row.asset));
    this.posts.push({ ...row });
  }

  async upsertAction(row: ActionRow): Promise<void> {
    this.actions = this.actions.filter((a) => !(a.tx === row.tx && a.kind === row.kind));
    this.actions.push({ ...row });
  }

  async listPosts(asset: string | undefined, since: number | undefined): Promise<PostRow[]> {
    return this.posts
      .filter((p) => (asset ? p.asset === asset : true) && (since !== undefined ? p.ts >= since : true))
      .sort((a, b) => a.ts - b.ts || a.asset.localeCompare(b.asset) || a.tx.localeCompare(b.tx));
  }

  async listActions(since: number | undefined): Promise<ActionRow[]> {
    return this.actions
      .filter((a) => (since !== undefined ? a.ts >= since : true))
      .sort((a, b) => a.ts - b.ts || a.kind.localeCompare(b.kind) || a.tx.localeCompare(b.tx));
  }

  async saveRelayerRun(state: RelayerRunState): Promise<void> {
    this.run = {
      lastRun: state.lastRun,
      lastError: state.lastError,
      assets: state.assets.map((a) => ({ ...a })),
    };
  }

  async loadRelayerRun(): Promise<RelayerRunState> {
    return {
      lastRun: this.run.lastRun,
      lastError: this.run.lastError,
      assets: this.run.assets.map((a) => ({ ...a })),
    };
  }

  async latestPostTsByAsset(): Promise<Record<string, number>> {
    const out: Record<string, number> = {};
    for (const p of this.posts) {
      if (out[p.asset] == null || p.ts > out[p.asset]) out[p.asset] = p.ts;
    }
    return out;
  }

  async listPendingSigs(): Promise<PendingSig[]> {
    return this.pending.map((p) => ({ ...p }));
  }

  async addPendingSigs(rows: PendingSig[]): Promise<void> {
    for (const row of rows) {
      this.pending = this.pending.filter((p) => !(p.sig === row.sig && p.asset === row.asset));
      this.pending.push({ ...row });
    }
  }

  async removePendingSigs(rows: { sig: string; asset: string }[]): Promise<void> {
    const drop = new Set(rows.map((r) => `${r.sig}::${r.asset}`));
    this.pending = this.pending.filter((p) => !drop.has(`${p.sig}::${p.asset}`));
  }
}

export class D1Store implements BraceStore {
  constructor(private db: D1Database) {}

  async upsertPost(row: PostRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO posts (
          tx, asset, ts, spot_e6, median_e6, sigma_bps, horizon_secs, k_x100,
          max_ltv_bps, effective_ltv_bps, confident, points, expiry_ts, ticker
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        row.tx,
        row.asset,
        row.ts,
        row.spot_e6,
        row.median_e6,
        row.sigma_bps,
        row.horizon_secs,
        row.k_x100,
        row.max_ltv_bps,
        row.effective_ltv_bps,
        row.confident,
        row.points,
        row.expiry_ts,
        row.ticker,
      )
      .run();
  }

  async upsertAction(row: ActionRow): Promise<void> {
    await this.db
      .prepare(
        `INSERT OR REPLACE INTO actions (
          tx, kind, ts, owner, amount, ltv, "limit", ok, error
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(row.tx, row.kind, row.ts, row.owner, row.amount, row.ltv, row.limit, row.ok, row.error)
      .run();
  }

  async listPosts(asset: string | undefined, since: number | undefined, limit?: number): Promise<PostRow[]> {
    const clauses: string[] = [];
    const params: (string | number)[] = [];
    if (asset) {
      clauses.push("asset = ?");
      params.push(asset);
    }
    if (since !== undefined) {
      clauses.push("ts >= ?");
      params.push(since);
    }
    const where = clauses.length ? `WHERE ${clauses.join(" AND ")}` : "";
    const asc = "ORDER BY ts ASC, asset ASC, tx ASC";
    let sql = `SELECT * FROM posts ${where} ${asc}`;
    if (limit !== undefined) {
      sql =
        since !== undefined
          ? `SELECT * FROM posts ${where} ${asc} LIMIT ?`
          : `SELECT * FROM (SELECT * FROM posts ${where} ORDER BY ts DESC, asset DESC, tx DESC LIMIT ?) ${asc}`;
      params.push(limit);
    }
    const res = await this.db.prepare(sql).bind(...params).all<PostRow>();
    return res.results ?? [];
  }

  async listActions(since: number | undefined, limit?: number): Promise<ActionRow[]> {
    const asc = "ORDER BY ts ASC, kind ASC, tx ASC";
    const params: number[] = [];
    let sql: string;
    if (since !== undefined) {
      sql = `SELECT * FROM actions WHERE ts >= ? ${asc}`;
      params.push(since);
      if (limit !== undefined) {
        sql += " LIMIT ?";
        params.push(limit);
      }
    } else if (limit !== undefined) {
      sql = `SELECT * FROM (SELECT * FROM actions ORDER BY ts DESC, kind DESC, tx DESC LIMIT ?) ${asc}`;
      params.push(limit);
    } else {
      sql = `SELECT * FROM actions ${asc}`;
    }
    const res = await this.db.prepare(sql).bind(...params).all<ActionRow>();
    return (res.results ?? []).map((row) => ({
      ...row,
      limit: (row as ActionRow & { limit?: number }).limit ?? (row as { LIMIT?: number }).LIMIT ?? null,
    }));
  }

  async saveRelayerRun(state: RelayerRunState, prev?: RelayerRunState): Promise<void> {
    // One round trip, and asset rows that did not change are not rewritten (D1 bills rows written).
    const before = new Map((prev?.assets ?? []).map((a) => [a.asset, a]));
    const stmts = [
      this.db
        .prepare(`INSERT OR REPLACE INTO relayer_runs (id, last_run, last_error) VALUES (1, ?, ?)`)
        .bind(state.lastRun, state.lastError),
    ];
    for (const a of state.assets) {
      const b = before.get(a.asset);
      if (b && b.lastSig === a.lastSig && b.lastAt === a.lastAt && b.lastError === a.lastError) continue;
      stmts.push(
        this.db
          .prepare(`INSERT OR REPLACE INTO relayer_assets (asset, last_sig, last_at, last_error) VALUES (?, ?, ?, ?)`)
          .bind(a.asset, a.lastSig, a.lastAt, a.lastError),
      );
    }
    await this.db.batch(stmts);
  }

  async loadRelayerRun(): Promise<RelayerRunState> {
    const runRes = await this.db.prepare(`SELECT last_run, last_error FROM relayer_runs WHERE id = 1`).all<{
      last_run: string | null;
      last_error: string | null;
    }>();
    const row = runRes.results?.[0];
    const assetsRes = await this.db
      .prepare(`SELECT asset, last_sig, last_at, last_error FROM relayer_assets ORDER BY asset`)
      .all<{ asset: string; last_sig: string | null; last_at: number | null; last_error: string | null }>();
    return {
      lastRun: row?.last_run ?? null,
      lastError: row?.last_error ?? null,
      assets: (assetsRes.results ?? []).map((a) => ({
        asset: a.asset,
        lastSig: a.last_sig,
        lastAt: a.last_at,
        lastError: a.last_error,
      })),
    };
  }

  async latestPostTsByAsset(): Promise<Record<string, number>> {
    // One MAX(ts) index seek per known asset (about 5 rows read). The old GROUP BY scanned every post.
    const values = ASSETS.map(() => "(?)").join(", ");
    const res = await this.db
      .prepare(
        `WITH a(asset) AS (VALUES ${values}) SELECT asset, (SELECT MAX(ts) FROM posts WHERE posts.asset = a.asset) AS last_ts FROM a`,
      )
      .bind(...ASSETS.map((x) => x.symbol))
      .all<{ asset: string; last_ts: number | null }>();
    const out: Record<string, number> = {};
    for (const row of res.results ?? []) if (row.last_ts != null) out[row.asset] = row.last_ts;
    return out;
  }

  async listPendingSigs(): Promise<PendingSig[]> {
    const res = await this.db
      .prepare(`SELECT sig, asset, submitted_at FROM pending_sigs ORDER BY submitted_at ASC, asset ASC`)
      .all<{ sig: string; asset: string; submitted_at: number }>();
    return (res.results ?? []).map((r) => ({
      sig: r.sig,
      asset: r.asset,
      submittedAt: r.submitted_at,
    }));
  }

  async addPendingSigs(rows: PendingSig[]): Promise<void> {
    if (!rows.length) return;
    const stmts = rows.map((row) =>
      this.db
        .prepare(`INSERT OR REPLACE INTO pending_sigs (sig, asset, submitted_at) VALUES (?, ?, ?)`)
        .bind(row.sig, row.asset, row.submittedAt),
    );
    await this.db.batch(stmts);
  }

  async removePendingSigs(rows: { sig: string; asset: string }[]): Promise<void> {
    if (!rows.length) return;
    const stmts = rows.map((row) =>
      this.db.prepare(`DELETE FROM pending_sigs WHERE sig = ? AND asset = ?`).bind(row.sig, row.asset),
    );
    await this.db.batch(stmts);
  }
}
