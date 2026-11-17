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
  listPosts(asset: string | undefined, since: number | undefined): Promise<PostRow[]>;
  listActions(since: number | undefined): Promise<ActionRow[]>;
  saveRelayerRun(state: RelayerRunState): Promise<void>;
  loadRelayerRun(): Promise<RelayerRunState>;
  latestPostTsByAsset(): Promise<Record<string, number>>;
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

  async listPosts(asset: string | undefined, since: number | undefined): Promise<PostRow[]> {
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
    const stmt = this.db
      .prepare(`SELECT * FROM posts ${where} ORDER BY ts ASC, asset ASC, tx ASC`)
      .bind(...params);
    const res = await stmt.all<PostRow>();
    return res.results ?? [];
  }

  async listActions(since: number | undefined): Promise<ActionRow[]> {
    const stmt =
      since !== undefined
        ? this.db
            .prepare(`SELECT * FROM actions WHERE ts >= ? ORDER BY ts ASC, kind ASC, tx ASC`)
            .bind(since)
        : this.db.prepare(`SELECT * FROM actions ORDER BY ts ASC, kind ASC, tx ASC`);
    const res = await stmt.all<ActionRow>();
    return (res.results ?? []).map((row) => ({
      ...row,
      limit: (row as ActionRow & { limit?: number }).limit ?? (row as { LIMIT?: number }).LIMIT ?? null,
    }));
  }

  async saveRelayerRun(state: RelayerRunState): Promise<void> {
    await this.db
      .prepare(`INSERT OR REPLACE INTO relayer_runs (id, last_run, last_error) VALUES (1, ?, ?)`)
      .bind(state.lastRun, state.lastError)
      .run();
    for (const a of state.assets) {
      await this.db
        .prepare(
          `INSERT OR REPLACE INTO relayer_assets (asset, last_sig, last_at, last_error) VALUES (?, ?, ?, ?)`,
        )
        .bind(a.asset, a.lastSig, a.lastAt, a.lastError)
        .run();
    }
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
    const res = await this.db.prepare(`SELECT asset, MAX(ts) AS last_ts FROM posts GROUP BY asset`).all<{
      asset: string;
      last_ts: number;
    }>();
    const out: Record<string, number> = {};
    for (const row of res.results ?? []) out[row.asset] = row.last_ts;
    return out;
  }
}
