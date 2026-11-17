# Brace relayer Worker

Cloudflare Worker that posts Gemini "price X or above" ladders to the Brace program on Solana devnet every minute. The program, not this Worker, does the implied-vol fit.

Do not put keys, seeds or tokens in this folder. `RELAYER_SECRET` is a Wrangler secret.

## Test (offline, uses captured Gemini fixtures)

```bash
cd worker
npm install
npm test
npx tsc --noEmit
```

Fixtures in `test/fixtures/` were fetched from the public Gemini API on 2026-11-17, 03:12 UTC.

## Deploy

Account ID (not secret) is in `wrangler.toml`. There is no Cloudflare API token in this environment, so deploys go through the Workers scripts API (see `scripts/cf-deploy-relayer.mjs`), not `wrangler deploy`.

1. `node ../scripts/cf-deploy-relayer.mjs` — local minify bundle only (dry-run).
2. Upload `dist/index.js` as Worker `brace-relayer` with vars `PROGRAM_ID` and `RPC_URL`, compatibility_date `2026-11-17`. Do not attach cron.
3. PUT the `RELAYER_SECRET` secret (base58 64-byte relayer key) via the secrets API. Never commit it.
4. Enable the workers.dev subdomain for the script.

Do not enable the minute cron until Task 7 (program on devnet and relayer funded). The exact later call is in `scripts/cf-deploy-relayer.mjs`.

Optional later: set `RPC_URL` to a QuickNode (or other) devnet URL.

## Endpoints

- `GET /health` → `{ ok, lastRun, lastSigs }` (in-memory; resets if the isolate is recycled).
- `GET /preview?asset=SOL` → selected ladder and encoded `post_quotes` bytes, no signing. Useful from a phone.

## Cron

`* * * * *`. One transaction per asset (SOL, BTC, ETH, XRP, ZEC). A failure on one asset does not stop the others. Logs only tickers and signatures.
