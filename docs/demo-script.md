# Demo script

**What the video must prove:** Gemini's prediction-market odds set a Solana lending limit live, and the chain enforces it.

Target: 2:30 (event allows 2 to 3 minutes). Narration at about 2.4 words per second.

## Time budget

| Criterion | Seconds |
|---|---|
| Demo (working product first) | 45 |
| Technical execution (onchain math, explorer proof) | 40 |
| Innovation (prediction markets as a risk oracle) | 25 |
| Impact and potential (long-tail collateral, CPI) | 25 |
| Product and UX (phone, no wallet needed) | 15 |

## Pre-flight

- Live URL loads; all five feeds (SOL, BTC, ETH, XRP, ZEC) updated in the last 2 minutes; `scripts/verify.sh --live` checks this
- Burner Phantom wallet on devnet with at least 0.6 SOL (0.5 deposit plus fees) (public address only on screen)
- Do Not Disturb on, notifications off, nothing private on screen
- Explorer tabs open: program, latest post_quotes tx, the failed borrow tx

## Shot list

| # | Sec | On screen | Narration cue | Proof shown |
|---|---|---|---|---|
| 1 | 0 to 10 | Risk board on phone | "Lending limits are set by vote. Brace sets them from live prediction markets." | Five assets, updated seconds ago |
| 2 | 10 to 30 | Tap SOL: Gemini ladder, implied vol, max LTV | "Gemini traders price SOL's next move. Brace turns that into a borrowing limit." | Ladder and limit |
| 3 | 30 to 55 | Phantom: borrow above limit, fails; borrow under, succeeds | "Over the limit: the chain says no. Under it: approved." | `RiskTightened` error, explorer |
| 4 | 55 to 95 | Explorer: post_quotes tx and logs | "The relayer posts raw quotes. The volatility math runs onchain, so anyone can check it." | Tx logs with sigma and limit |
| 5 | 95 to 120 | History timeline (Streams) | "QuickNode Streams records every update and every blocked borrow." | Timeline, blocked feed |
| 6 | 120 to 145 | ZEC vs BTC limits; accuracy number | "ZEC has no options market. Gemini prices it anyway. Our hit rate this week: [Alchin's measured number; cut this line if there is none]." | Board + tracker result |
| 7 | 145 to 150 | Repo link | "Odds can only tighten limits, never liquidate anyone. That's Brace." | URL |

Narration is finalized after the build, using real numbers only.
