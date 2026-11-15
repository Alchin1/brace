# Gates

## Day-one checks (probed Nov 11 from the cloud workspace)

| # | Check | Status | Detail / fix |
|---|---|---|---|
| 1 | Toolchain | CLEAR | Solana CLI 4.3.2 (Agave) and Anchor CLI 1.2.2 installed. `anchor init` + `anchor build` produced a `.so` and IDL; LiteSVM tests run in the shell, so contract tests need no RPC. |
| 2 | Chain reachability | CLEAR | `getVersion` against `api.devnet.solana.com` works from the shell (solana-core 4.4.0). Claude can deploy from the shell once the deployer key holds devnet SOL. |
| 3 | Phone wallet | CLEAR (verify on phone) | Phantom on Android: Settings, Developer Settings, Testnet Mode on, Solana Devnet. Solflare also supports devnet. Open the app's URL in the wallet's in-app browser. |
| 4 | Faucet | WORKAROUND | Shell airdrop failed (rate limited). Oh-Jay claims devnet SOL at faucet.solana.com on his phone and sends it to the deployer address Claude gives him. About 5 devnet SOL covers deploy plus a week of relayer posts. |
| 5 | Deploy path | CLEAR (needs token) | Vercel API reachable from the shell. Oh-Jay gives a Vercel token; Claude creates the project and deploys. Token stays in env only. |
| 6a | Gemini Prediction Markets API | CLEAR | Public endpoints (events, live bid/ask, settlements) and the spot ticker work with no key. Trading is US-only and not needed. |
| 6b | QuickNode Streams | GATE | API reachable (returns 401 without a key). Needs a QuickNode account (free trial) and API key from Oh-Jay. Solana devnet is a supported Streams network. |
| 6c | Relayer host | GATE | Cloudflare API reachable. A Worker cron posts Gemini quotes every minute (Vercel Hobby crons run only daily). Needs a Cloudflare API token (Workers edit) from Oh-Jay. |
| 7 | Repo access | GATE | Repo not created yet. Created only after the teammate gate passes. |

Nothing is BLOCKED without a workaround.

## Your steps

| Step | When | How (phone) | Status |
|---|---|---|---|
| Send the team post and the organizer questions in the UBC Telegram | Now | Copy from chat, paste in t.me/+Q0hy2P7nbIk2YWIx | Pending |
| Paste the guide's Solana, Gemini and QuickNode requirements to Claude | Now | Open the hackathon guide link on Devpost or the site, copy the sections | Pending |
| Register on Devpost and for UBC 2026 on Luma | Now | ubc-hackathon-2026.devpost.com, then the Luma ticket link on the site | Pending |
| **Teammate gate: a US teammate committed, ticket confirmed, 50/50 split in writing** | **By end of Fri Nov 13** | Telegram DMs | Pending |
| Create repo `ohjay-official/brace`, README on | After the gate | github.com, New repository, public, Add README | Pending |
| Vercel token | After the gate | vercel.com, Settings, Tokens, Create (Desktop site in Chrome if cramped) | Pending |
| Cloudflare API token (Workers edit) | After the gate | dash.cloudflare.com, My Profile, API Tokens, "Edit Cloudflare Workers" template | Pending |
| QuickNode account + API key | After the gate | quicknode.com, sign up, free trial, API keys | Pending |
| Devnet SOL to the deployer address | When Claude sends the address | faucet.solana.com, sign in with GitHub, paste address, Devnet, 5 SOL | Pending |
| Phantom Testnet Mode on | Before the first phone check | Phantom, Settings, Developer Settings | Pending |
| Gemini office hours | Thu Nov 19, 1:00 AM Lagos | Zoom link from the schedule | Pending |
| QuickNode office hours | Fri Nov 20, 1:00 AM Lagos | Zoom link from the schedule | Pending |
| Record the 2 to 3 minute video | By Thu Nov 19 | Screen recording on phone, script from docs/demo-script.md | Pending |
| Submit on Devpost | By Fri Nov 20, 7:00 PM Lagos (aim for noon) | Fields from docs/submission-draft.md | Pending |
