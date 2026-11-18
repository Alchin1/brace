/**
 * In-isolate read cache in front of D1, so /history and /actions stop re-reading the same rows.
 *
 * Why: D1 bills rows read. The app asks /history for "the last 24h" with a since that moves every
 * poll, so URL-keyed edge caching never hits, and each poll re-read ~1,440 rows per asset. Here each
 * asset keeps a sliding window of posts in memory and only reads rows newer than the last one it has.
 * On a D1 error the last good window or response is served instead of failing.
 */
import { MAX_ROWS, windowRows } from "./history.ts";
import { D1Store, type ActionRow, type BraceStore, type HealthReport, type PostRow } from "./store.ts";

/** How long a cached read is served before D1 is asked again (and the Cache-Control max-age). */
export const READ_TTL_SECS = 30;
/** Window of posts kept per asset. The app asks for 24h; 26h leaves room. */
export const POST_WINDOW_SECS = 26 * 3600;
/** Full re-read of a window this often, so any late Stream row is picked up. */
export const FULL_RELOAD_SECS = 1800;
/** /health is served from memory this long. */
export const HEALTH_TTL_SECS = 15;
const MEMO_MAX = 64;

export type CachedRead<T> = { rows: T[]; source: "d1" | "cache" | "stale"; storeError?: string };

type PostWindow = { start: number; rows: PostRow[]; fetchedAt: number; loadedAt: number };
type Memo<T> = { at: number; rows: T[] };

function cmp(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

export function comparePosts(a: PostRow, b: PostRow): number {
  return a.ts - b.ts || cmp(a.asset, b.asset) || cmp(a.tx, b.tx);
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

export class ReadCache {
  windows = new Map<string, PostWindow>();
  memo = new Map<string, Memo<unknown>>();
  health: { at: number; report: HealthReport & { storeError: string | null } } | null = null;

  /** New rows were written: drop memoized responses, and make each post window read its delta next time. */
  invalidate(): void {
    this.memo.clear();
    this.health = null;
    for (const w of this.windows.values()) w.fetchedAt = Number.NEGATIVE_INFINITY;
  }

  clear(): void {
    this.windows.clear();
    this.memo.clear();
    this.health = null;
  }

  private remember<T>(key: string, rows: T[], now: number): void {
    this.memo.delete(key);
    this.memo.set(key, { at: now, rows });
    while (this.memo.size > MEMO_MAX) {
      const oldest = this.memo.keys().next().value;
      if (oldest === undefined) break;
      this.memo.delete(oldest);
    }
  }

  private async memoized<T>(key: string, now: number, load: () => Promise<T[]>): Promise<CachedRead<T>> {
    const hit = this.memo.get(key) as Memo<T> | undefined;
    if (hit && now - hit.at < READ_TTL_SECS) return { rows: hit.rows, source: "cache" };
    try {
      const rows = await load();
      this.remember(key, rows, now);
      return { rows, source: "d1" };
    } catch (err) {
      if (hit) return { rows: hit.rows, source: "stale", storeError: errMessage(err) };
      throw err;
    }
  }

  /** Same rows and order as store.listPosts(asset, since, limit), read from D1 as little as possible. */
  async posts(
    store: BraceStore,
    asset: string | undefined,
    since: number | undefined,
    limit: number,
    now: number,
  ): Promise<CachedRead<PostRow>> {
    const windowed = asset !== undefined && since !== undefined && since >= now - POST_WINDOW_SECS && since <= now + 3600;
    if (!windowed) {
      return this.memoized(`p|${asset ?? ""}|${since ?? ""}|${limit}`, now, async () =>
        windowRows(await store.listPosts(asset, since, limit), since, limit),
      );
    }
    let w = this.windows.get(asset);
    let source: CachedRead<PostRow>["source"] = "cache";
    try {
      if (!w || w.start > since || now - w.loadedAt >= FULL_RELOAD_SECS) {
        const start = Math.floor((now - POST_WINDOW_SECS) / 600) * 600;
        const rows = await store.listPosts(asset, start, MAX_ROWS);
        if (rows.length >= MAX_ROWS) {
          this.windows.delete(asset);
          return { rows: windowRows(await store.listPosts(asset, since, limit), since, limit), source: "d1" };
        }
        w = { start, rows: [...rows].sort(comparePosts), fetchedAt: now, loadedAt: now };
        this.windows.set(asset, w);
        source = "d1";
      } else if (now - w.fetchedAt >= READ_TTL_SECS) {
        const maxTs = w.rows.length ? w.rows[w.rows.length - 1].ts : w.start;
        // Rows at or after the newest cached ts; only new posts are read.
        const delta = await store.listPosts(asset, maxTs, MAX_ROWS);
        if (delta.length >= MAX_ROWS) {
          this.windows.delete(asset);
          return { rows: windowRows(await store.listPosts(asset, since, limit), since, limit), source: "d1" };
        }
        let rows = w.rows.filter((r) => r.ts < maxTs).concat(delta).sort(comparePosts);
        let start = w.start;
        const cutoff = Math.floor((now - POST_WINDOW_SECS) / 600) * 600;
        if (cutoff > start) {
          rows = rows.filter((r) => r.ts >= cutoff);
          start = cutoff;
        }
        w = { start, rows, fetchedAt: now, loadedAt: w.loadedAt };
        this.windows.set(asset, w);
        source = "d1";
      }
    } catch (err) {
      if (w && w.start <= since) {
        return { rows: w.rows.filter((r) => r.ts >= since).slice(0, limit), source: "stale", storeError: errMessage(err) };
      }
      throw err;
    }
    return { rows: w.rows.filter((r) => r.ts >= since).slice(0, limit), source };
  }

  /**
   * Same rows as store.listActions(since, limit). since is rounded down to the minute for the cache
   * key, then filtered exactly; if the rounded read hits the limit, the exact query is used instead.
   */
  async actions(store: BraceStore, since: number | undefined, limit: number, now: number): Promise<CachedRead<ActionRow>> {
    if (since === undefined) return this.memoized(`a||${limit}`, now, async () =>
        windowRows(await store.listActions(undefined, limit), undefined, limit),
      );
    const q = Math.floor(since / 60) * 60;
    const read = await this.memoized(`a|${q}|${limit}`, now, async () => windowRows(await store.listActions(q, limit), q, limit));
    if (q !== since && read.rows.length >= limit) {
      return this.memoized(`a|${since}|${limit}|exact`, now, async () =>
        windowRows(await store.listActions(since, limit), since, limit),
      );
    }
    return { ...read, rows: read.rows.filter((r) => r.ts >= since) };
  }
}

const d1Cache = new ReadCache();
const byStore = new WeakMap<BraceStore, ReadCache>();

/** One cache for the production D1 database; one per store object otherwise (tests). */
export function cacheFor(store: BraceStore): ReadCache {
  if (store instanceof D1Store) return d1Cache;
  let c = byStore.get(store);
  if (!c) {
    c = new ReadCache();
    byStore.set(store, c);
  }
  return c;
}
