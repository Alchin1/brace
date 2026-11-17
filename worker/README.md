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

## Deploy (gated: Cloudflare token + Account ID)

1. Put the real Account ID in `wrangler.toml` (`account_id` is currently a placeholder).
2. `wrangler secret put RELAYER_SECRET` — base58 64-byte relayer secret key. Never commit it.
3. `CLOUDFLARE_API_TOKEN=… CLOUDFLARE_ACCOUNT_ID=… npx wrangler deploy`

Vars already in `wrangler.toml` (not secret): `PROGRAM_ID`, `RPC_URL`. Optional override: set `RPC_URL` to a QuickNode (or other) devnet URL.

## Endpoints

- `GET /health` → `{ ok, lastRun, lastSigs }` (in-memory; resets if the isolate is recycled).
- `GET /preview?asset=SOL` → selected ladder and encoded `post_quotes` bytes, no signing. Useful from a phone.

## Cron

`* * * * *`. One transaction per asset (SOL, BTC, ETH, XRP, ZEC). A failure on one asset does not stop the others. Logs only tickers and signatures.
