# Runbook

What to do if something breaks between now and judging on Sat Nov 21. All times are Lagos (WAT, UTC+1) unless marked CST.

## Health in one command

```bash
scripts/verify.sh --live
```

Passes when the app returns 200, the relayer reports `ok` with no `lastError`, and all five feeds (SOL, BTC, ETH, XRP, ZEC) posted in the last 120 seconds. On a phone, open `https://brace-relayer.ohjaye0.workers.dev/health` and check `"ok":true` and `"lastError":null`.

## What depends on what

| Piece | Where | If it is down |
|---|---|---|
| Web app | Vercel, project deploys from `main` automatically. `https://braced.vercel.app` | Nothing loads. Roll back Vercel (below). |
| Relayer Worker `brace-relayer` | Cloudflare account `f5541f7a5c900e912b145e07fbc95d63`, cron every minute | Feeds stop updating. The program holds the last limit 5 minutes, then steps it down; after an hour borrowing pauses. Roll back the Worker (below). |
| Program `Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC` | Solana devnet | Borrow page and board cannot read. Wait out devnet; nothing to roll back. |
| History (`/history`, `/actions`) | QuickNode Stream `brace-program` to Worker `/streams`, stored in D1 | History page goes quiet. Board and borrow still work. Check the Stream in the QuickNode dashboard. |
| D1 database `brace` (free plan) | Cloudflare D1, daily limits 5M rows read and 100k rows written, reset 00:00 UTC (01:00 Lagos) | Onchain posting keeps running (pending signatures fall back to memory). `/health` stays 200 with `storeError` set and feed ages read from the program's Feed accounts. `/history` and `/actions` serve the last cached rows, else a 503 JSON message. `/streams` answers 503 instead of crashing; Stream rows QuickNode does not redeliver are missing from history (onchain data is unaffected). Nothing to do but wait for the reset; never upgrade the plan. |
| Gemini public API | Read by the Worker | Posts turn unconfident; limits hold, then step down. Nothing to do. |
| Devnet RPC for the Worker | OnFinality, then Tatum (failover in `RPC_URLS`) | Posts fail with a `lastError`. They retry every minute. |
| Devnet RPC for the browser | `api.devnet.solana.com` | Board shows "Devnet is not answering. Trying again." Tap Try again. |

## Roll back the Worker (Cloudflare versions)

Every upload creates a numbered version; a deployment says which version serves 100% of traffic. Rolling back changes no code in git, keeps the bindings and secrets of that version, and keeps the cron.

Versions on Nov 17, 2026:

| Version | Id | Uploaded (WAT) | What |
|---|---|---|---|
| 8 (current) | `276628d1-b8f9-4eb6-aee1-48f711f62c66` | Nov 17, 12:29 | B6: bounded `/history`, 400 on bad input, Gemini and RPC timeouts |
| 7 (last known good before) | `2fe05917-17f2-4db8-8f7e-74fe440e78de` | Nov 17, 05:23 | Before B6. Bad input returns 200 instead of 400 |

Both versions have the same bindings: `DB` (D1), `PROGRAM_ID`, `RPC_URL`, `RPC_URLS`, and the secrets `RELAYER_SECRET` and `STREAMS_SINK_SECRET`.

**Dashboard (easiest, works on a phone browser)**
1. Cloudflare dashboard, Workers and Pages, `brace-relayer`, Deployments.
2. Pick the version to go back to, choose Rollback (or Deploy), confirm.
3. Wait one minute, then run the health check above.

**Cloudflare API** (what the drill used, through the Cloudflare connector; any API token with Workers edit rights works the same way)

```text
POST /accounts/f5541f7a5c900e912b145e07fbc95d63/workers/scripts/brace-relayer/deployments
{"strategy":"percentage","versions":[{"version_id":"<version id>","percentage":100}]}
```

**Wrangler**, from `worker/`: `npx wrangler rollback <version id>` (needs a Cloudflare login on that machine).

**Redeploy from source** if versions are not enough: `node scripts/cf-deploy-relayer.mjs` bundles to `worker/dist/index.js`, then upload it with `keep_bindings: ["secret_text"]` so the secrets stay. Never paste secret values anywhere.

### Drill, Nov 17, 2026 (done)

| Step | Time (WAT) | Result |
|---|---|---|
| Before | 15:33 | `/health` ok, `lastError` null; `/history?asset=FOO` returned 400 (version 8 behavior) |
| Roll back to version 7 | 15:33 | Deployment `b7789d5c-4620-4172-b132-671a6d2110f5`. `/history?asset=FOO` returned 200 within seconds, so version 7 was serving |
| Check | 15:34 | Cron posted under version 7 at 15:34:18. `scripts/verify.sh --live`: all five feeds 26 s old, relayer healthy |
| Roll forward to version 8 | 15:34 | Deployment `8758f6b2-6095-40a0-9b05-3a843c369990`. `/history?asset=FOO` back to 400 within 10 seconds |
| Check | 15:36 to 15:37 | `scripts/verify.sh --live` passed; cron posted at 15:35:18 and 15:36:17; Streams row for SOL landed at 15:36:22; `POST /streams` without the secret still returns 401 |

Total time on the old version: about 90 seconds. No feed went stale.

## Roll back the web app (Vercel Instant Rollback)

Vercel builds every push to `main`. If a push breaks production:

1. Vercel dashboard, the Brace project, overview page.
2. On the Production Deployment tile, click **Instant Rollback**, pick the previous deployment, **Continue**, then **Confirm Rollback**. On the Hobby plan only the immediately previous deployment is offered.
3. Open `https://braced.vercel.app` and check the board loads.

After a rollback, Vercel stops putting new pushes on the production domain. To go back to normal, fix `main`, then on the overview page click **Manage** on the Production Deployment tile and promote the new deployment (or run `vercel promote <deployment url>`). Until then, pushes to `main` will not go live.

Alternative without the dashboard: `git revert` the bad commit and push to `main`. Vercel deploys the revert in about a minute.

Not drilled: there is no Vercel login or token on the box, and a production rollback would freeze auto-deploys until someone promotes again. Production deploy history is visible on GitHub as commit statuses named "Vercel".

## Deadlines and expiries

| Date and time (WAT) | What | Action |
|---|---|---|
| Wed Nov 18, 1:00 to 2:00 AM | Office hours: Cursor (Grok Bot), Gemini. Tue Nov 17, 6 PM CST | Optional. Good place to confirm the Grok Bot bounty fit |
| Thu Nov 19, 1:00 to 2:00 AM | Office hours: QuickNode, Solana, Circle. Wed Nov 18, 6 PM CST | Optional. Ask QuickNode to look at the Stream setup |
| Thu Nov 19, night | Video recorded and uploaded (team target) | docs/demo-script.md |
| Fri Nov 20, 1:00 to 2:00 AM | Office hours: Gemini, Solana. Thu Nov 19, 6 PM CST | Last chance to ask Gemini about the bounty |
| Fri Nov 20, 3:00 PM | Team target to submit on Devpost | docs/submission-draft.md |
| **Fri Nov 20, 7:00 PM** | **Devpost hard deadline** (12:00 PM CST) | Nothing can be added after this |
| Sat Nov 21, 6:59 AM | Finalists notified (Fri Nov 20, 11:59 PM CST) | Check email and Telegram |
| Sat Nov 21 | In-person judging and closing ceremony. Finalists get 5 min pitch and 2 min Q&A. Prizes need people present in person | Alchin and Omar; docs/pitch.md |
| Sun Nov 22, 3:00 PM | BCH BLAZE (Holdfast) closes. Separate project | Do not touch its services while working on Brace |
| Daily, about 11:00 PM | SOL, ETH, XRP and ZEC ladders the Worker used today expired at 23:00 WAT (22:00 UTC tickers). BTC also has hourly ladders | Nothing. The Worker picks the earliest ladder 15 minutes to 72 hours out each minute. If Gemini lists none in that window, that asset's limit holds, then steps down |
| About mid-December (exact date unknown) | QuickNode Build plan from the UBC coupon ends (a free month, per Oh-Jay on Nov 17) | Check the QuickNode billing page. After it ends, History stops updating unless the plan is renewed |
| No expiry | Devnet program. Programs stay on devnet unless devnet is reset (rare, announced by Solana) | Upgrade authority `FncbMMNBCFVv76GsPP8FJhkNGHkmAZfw7gnkkBj7SvdM` can redeploy |
| About late February 2027 | Relayer devnet SOL runs out at the measured rate | See below |

### Devnet SOL

| Wallet | Address | Balance, Nov 17 15:37 WAT |
|---|---|---|
| Relayer (pays every post) | `BSzBknNiGxiYXtjsK7wcHgvYg88BMQx1j26dKbfYfmRo` | 0.98900918 SOL |
| Deployer and upgrade authority | `FncbMMNBCFVv76GsPP8FJhkNGHkmAZfw7gnkkBj7SvdM` | 0.280830884 SOL |
| Phantom demo wallet | `CM7My7aNN9RKb6rTJvBE4cjTt3zaGS6f22FT1BVYwSJP` | 0.39709176 SOL |

Relayer burn, measured: 0.99037776 SOL at 12:24 to 0.98900918 SOL at 15:37 on Nov 17 is 0.00136858 SOL in 193 minutes, about 0.01 SOL a day, so roughly 95 days of runway. Top it up at `https://faucet.solana.com` (Devnet) if it ever drops below 0.1 SOL. The deployer only needs SOL for a program upgrade, which would cost more than it has (the program is about 354 KB), so get more from the faucet before any redeploy.

Devnet only. None of this SOL has value. Keys stay in `/home/box/keys` and are never committed or printed.

## If the demo breaks during judging

1. Board not loading: open `https://brace-relayer.ohjaye0.workers.dev/health`. If ok, it is the browser RPC: tap Try again, or switch from Wi-Fi to mobile data.
2. Borrow fails with "expired": tap again and confirm faster.
3. Everything down: play the video, then show the README Proof section, which links verified transactions on Solana Explorer.
