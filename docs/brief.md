# Brace

**One line:** Brace turns Gemini's prediction markets into an onchain volatility oracle, so Solana lending markets tighten their limits before volatility arrives.

## Problem, and who has it

Lending markets set loan-to-value limits by governance vote and change them rarely. When volatility jumps, the limits are still the calm-week numbers, so borrowers take on risk the pool can't absorb and liquidations cascade after the move. Protocols that want forward-looking limits buy implied-volatility feeds built from options markets, which mostly cover majors like BTC and ETH. Deribit, the largest crypto options venue, lists options on only 7 coins (BTC, ETH, SOL, HYPE, XRP, AVAX, TRX; checked Nov 15). Collateral like ZEC and commodity tokens (silver, oil, gas) has no crypto options market at all, so it gets static limits or none.

Who has it: Solana lending protocols and the risk curators who run their vaults (Gauntlet, Galaxy, Hyperithm on Kamino), and every borrower who gets liquidated in a move the market saw coming.

## Solution

Gemini lists regulated "X or above" price ladders for BTC, ETH, SOL, XRP, ZEC, HYPE, silver, oil, gas and copper, from hourly to multi-week expiries. A ladder is a market-implied probability curve, and a probability curve gives you implied volatility.

1. **Relayer** (Cloudflare Worker, every minute) reads Gemini's live ladders from the public API and posts the raw quotes (strike, bid, ask, expiry, event ticker) to Solana devnet. It posts quotes, never conclusions.
2. **Brace program** (Anchor) filters the quotes, converts each midpoint to a z-score with a fixed lookup table, fits the curve by least squares, and stores implied volatility plus a confidence score per asset. All of this math runs onchain, so anyone can check it.
3. **Risk rule:** max LTV = the lower of the governance max and a volatility-adjusted limit. Odds can only tighten limits, never loosen them past governance, and never liquidate anyone. Stale or low-confidence data falls back to the governance default.
4. **Demo lending pool:** deposit devnet SOL, borrow test USDC. Borrows and withdrawals are checked against Brace's live limit; liquidation uses the fixed threshold only. Any other lending program can make the same check through one CPI.
5. **QuickNode Streams** watches the Brace program on devnet and feeds a webhook that records every volatility update, blocked borrow and liquidation. That history powers the dashboard timeline and keeper alerts.

## The 30-second money shot

Open the Brace link on a phone, no wallet needed: the risk board shows Gemini-implied volatility and the resulting max LTV per asset, updated in the last minute, each with an explorer link to the onchain computation (for example, with an 80% liquidation threshold, a 75% governance max and a 24-hour, 3-sigma buffer, the Nov 11 test numbers give SOL at about 62% vol a 72% limit, ZEC at about 200% vol a 55% limit, and BTC at about 36% vol the full 75%; final parameters go in the spec). Connect a devnet wallet, try to borrow above SOL's limit: the transaction fails onchain with `RiskTightened`. Borrow under it: it succeeds. The timeline below, fed by Streams, shows the limit moving with Gemini's odds all week.

## Why it wins

- **Not the crowded lane.** The organizers published "a DeFi prediction market with Gemini's API" as their example, so most entries will be prediction market apps. Brace uses Gemini's markets as infrastructure for the rest of DeFi, the lane Colosseum has been funding (Senthos, Cesto) and nobody has taken for risk.
- **DeFi track, word for word:** "new financial primitives (... lending ...) that compose with what already exists." Brace is a risk primitive any lending program can call.
- **Best use of Solana:** the volatility math runs onchain in a devnet program, inside compute limits, callable by CPI, with every update visible on the explorer.
- **Gemini bounty:** remove Gemini and Brace has no data. It also puts Gemini's markets in front of DeFi protocols, which matches Gemini's stated push for outside distribution partners.
- **QuickNode bounty:** Streams carries the product's entire history and alert feed, which makes it core rather than decorative.
- **One hard number for the pitch:** Gemini's ladders recovered spot prices within 0.1% and gave coherent implied volatility across four expiries in the Nov 11 live test (research.md, section 4).

## Tracks

| Prize | How Brace meets it |
|---|---|
| DeFi & Onchain Apps (main track) | Lending risk primitive plus a working demo pool |
| Best use of Solana | Anchor program on devnet; onchain math; CPI interface |
| Gemini Prediction Markets bounty | Live Gemini ladders are the only input to the oracle |
| QuickNode Streams bounty | Devnet stream of the Brace program drives history, timeline and keeper |
| Official UBC winner | Same entry |

## Scope

**In:**
- Brace program: config, quote posting, onchain volatility fit, confidence, max LTV per asset
- Demo pool: deposit SOL, borrow test USDC, repay, withdraw, liquidate at a fixed threshold
- Relayer posting SOL every minute; risk board covering SOL, BTC, ETH, XRP, ZEC and silver
- Streams webhook, event log, timeline, blocked-borrow feed
- Phone-first web app with a no-wallet risk board
- README in the judge-first format; 2 to 3 minute video

**Out:**
- Mainnet and real funds
- Interest rates (0% in the demo pool, stated plainly)
- More than one collateral type in the pool
- Trading on Gemini (US-only)
- AI anything

**Nice-to-have, cut first:**
- Event premium before scheduled macro events (Gemini's Fed decision market)
- Shadow mode: what Brace's limits would mean for real Kamino positions, read-only
- A second tiny program that calls Brace by CPI, to prove composability

## Risks

- **Scope against Holdfast.** Two builds in one week. Mitigation: the plan's nice-to-haves get cut first; the risk board plus one borrow check is the demo.
- **Teammate gate.** No committed US teammate by the end of Fri Nov 13 means UBC stops here.
- **Thin Gemini liquidity.** Quotes exist, trades are rare. Confidence scoring plus fallback to governance defaults; the README says so plainly.
- **Relayer trust.** A dishonest relayer could misreport quotes. It can't fake the math, and a bad quote can only tighten limits. Every posted quote carries the Gemini event ticker and timestamp for audit.
- **We can't make volatility happen on demand.** The demo shows real live numbers; any replay of earlier recorded data is labeled as a replay.
- **Gemini data terms.** Ask at Gemini office hours (Thu Nov 19, 1:00 AM Lagos) whether publishing derived values onchain is fine.
- **QuickNode free trial limits** on devnet streams: verify on day one.
