-- Brace Streams sink. Integers on disk; /history converts to the
-- accuracy-tracker contract (floats) defined in docs/spec.md.
CREATE TABLE IF NOT EXISTS posts (
  tx TEXT NOT NULL,
  asset TEXT NOT NULL,
  ts INTEGER NOT NULL,
  spot_e6 INTEGER NOT NULL,
  median_e6 INTEGER NOT NULL,
  sigma_bps INTEGER NOT NULL,
  horizon_secs INTEGER NOT NULL,
  k_x100 INTEGER NOT NULL,
  max_ltv_bps INTEGER NOT NULL,
  effective_ltv_bps INTEGER NOT NULL,
  confident INTEGER NOT NULL,
  points INTEGER NOT NULL,
  expiry_ts INTEGER NOT NULL,
  ticker TEXT NOT NULL,
  PRIMARY KEY (tx, asset)
);

CREATE INDEX IF NOT EXISTS posts_asset_ts ON posts (asset, ts);

CREATE TABLE IF NOT EXISTS actions (
  tx TEXT NOT NULL,
  kind TEXT NOT NULL,
  ts INTEGER NOT NULL,
  owner TEXT,
  amount INTEGER,
  ltv INTEGER,
  "limit" INTEGER,
  ok INTEGER NOT NULL,
  error TEXT,
  PRIMARY KEY (tx, kind)
);

CREATE INDEX IF NOT EXISTS actions_ts ON actions (ts);

-- Relayer run state so /health survives isolate recycle.
CREATE TABLE IF NOT EXISTS relayer_runs (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  last_run TEXT,
  last_error TEXT
);

CREATE TABLE IF NOT EXISTS relayer_assets (
  asset TEXT PRIMARY KEY,
  last_sig TEXT,
  last_at INTEGER,
  last_error TEXT
);

-- Fire-and-forget signatures confirmed on a later cron tick.
CREATE TABLE IF NOT EXISTS pending_sigs (
  sig TEXT NOT NULL,
  asset TEXT NOT NULL,
  submitted_at INTEGER NOT NULL,
  PRIMARY KEY (sig, asset)
);
