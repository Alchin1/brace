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

export interface BraceStore {
  upsertPost(row: PostRow): Promise<void>;
  upsertAction(row: ActionRow): Promise<void>;
  listPosts(asset: string | undefined, since: number | undefined): Promise<PostRow[]>;
  listActions(since: number | undefined): Promise<ActionRow[]>;
}

export class MemoryStore implements BraceStore {
  posts: PostRow[] = [];
  actions: ActionRow[] = [];

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
}
