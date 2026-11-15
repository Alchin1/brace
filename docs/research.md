# UBC 2026: research before ideas

Researched Nov 11, 2026. Coverage is about 35 projects, not the 50 the playbook asks for: the UBC 2026 and MBC 2025 project galleries are on Devpost, which is blocked from Claude's environment. Most entries below come from winner announcements and READMEs, not from running the demos. That gap is noted where it matters.

## 1. Past winners benchmark

| Project | Event | Place | What it did | Money shot | Tech | Why it won (stated or inferred) |
|---|---|---|---|---|---|---|
| PolyYield | NexHacks 2026 (CMU) | Best use of Solana | No-loss predictions on Polymarket-style markets; losers keep principal | Deposit USDC, pick YES/NO, withdraw after resolution | Anchor 0.30 vault on devnet, Next.js on Vercel, Supabase, Polymarket API | Working devnet program + live URL + familiar external data (inferred) |
| Base Bets | MBC 2025 (UBC's predecessor) | Team project (placing unknown) | Two-party USDC escrow settled by a Polymarket outcome | Make a bet with a friend, it settles itself | Solidity on Base, Polymarket condition IDs | Sponsor data as the settlement source (inferred) |
| Manifest | MBC 2025 | Submission (placing unknown) | Conference-specific prediction markets with a bounty for whoever makes the event happen | "Will someone pie Jesse?" | Next.js mini app | Local, funny, on-theme (inferred) |
| Trepa | Colosseum Breakout 2025 | 1st Consumer, $25k | Sentiment prediction mobile app with precise bets | Bet on an exact number, not yes/no | Solana mobile | Sharper market design than binary (stated: precision) |
| Melee Markets | Breakout 2025 | 2nd Consumer | Viral markets blending speculation and prediction | Social virality | Solana | Distribution angle |
| Fora | Colosseum Cypherpunk 2025 | 3rd | Group-chat trading plus prediction market protocol | Trade inside a chat | Solana | Social distribution |
| Senthos | Colosseum Frontier 2026 | Top 25, accelerator | Structured products on prediction market flow, risk-tiered and composable | Tranches of PM exposure | Solana | Turns PMs into DeFi building blocks |
| Bench | Frontier 2026 | Top 25 | Opportunity markets: signals visible only to the market creator | Private signal market | Solana | Novel market type |
| Mentioned | Frontier 2026 | Top 25 | Bet on which words appear in media | Live word markets | Solana | Novel market type |
| Memetic Machines | Frontier 2026 | Top 25 | News events into tradeable YES/NO markets | Headline becomes a market | Solana | Market creation speed |
| Cesto | Frontier 2026 | Top 25 | Thematic baskets of RWAs, prediction markets and perps | One-tap basket | Solana | Composability across asset types |
| YieldCompass | Frontier 2026 | Top 25 | DeFi yield search with realized APY and protocol risk scores | Honest yields | Solana | Risk transparency |
| Dropset | Frontier 2026 | Top 25, accelerator | Onchain FX at scale | FX swaps | Solana | New market |
| WeLikeSports | Frontier 2026 | Top 25 | Fantasy pools that earn from interest, no house rake | Pool earns yield | Solana | Yield-funded prizes |
| Clawpump | Frontier 2026 | Top 25 | Launch agents for swaps, lending, perps, prediction markets | Agent does the trade | Solana | Agentic finance |
| CrowdBrain | Frontier 2026 | Grand Champion, $30k | Robotics DePIN | Real robots | Solana | Grand prizes go to big infra theses |
| TapeDrive | Breakout 2025 | Grand Champion, $50k | Cheap decentralized storage | 1,400x cheaper storage | Solana | Infra with a hard number |
| Reflect | Colosseum Radar 2024 | Grand Champion, $50k | Hedge-backed stablecoin (Solana's Ethena) | Delta-neutral dollar | Solana | New DeFi primitive |
| Pregame | Radar 2024 | 1st Consumer | P2P sports betting | Bet a friend | Solana | Simple, social |
| FXSwap | Radar 2024 | 1st Payments | Forex to stablecoin swaps | FX in one swap | Solana | Real-world use |
| Capitola | Colosseum cohort 4 | Accelerator | Prediction market meta-aggregator, best price across venues | Best odds anywhere | Solana | Aggregation |
| Synthesis | Colosseum cohort 4 | Accelerator | PM aggregation trading platform | Unified PM trading | Solana | Aggregation |
| Pin Point | QuackHacks Feb 2026 | Best use of Solana | Location-verified media stamped onchain against deepfakes | Verify a photo | Solana mainnet, on-device ML | Mainnet + clear real problem |
| ExtraLife | ETHGlobal HackMoney 2026 | ENS prize | No-loss prediction markets on DeFi yield | Never lose principal | EVM | Sponsor integration |
| EcoRound | Chainlink Convergence 2026 | Submission | No-loss esports PM on Morpho yield, CRE resolution | Losers get 100% back | EVM, Chainlink CRE | Oracle-settled |
| VeritasX | Chainlink 2026 hackathon | 2nd Privacy | Private PM settled by Gemini AI via CRE | Hidden bets | EVM, CRE | Privacy + AI settlement |
| Vektar | Chainlink Convergence 2026 | Submission | Settlement oracle: what a PM position can exit for now, BFT-signed | Early exit at oracle value | EVM | PM data as an oracle for other protocols |
| Lattice | Arbitrum buildathon (HackQuest) | Submission | Correlation-aware parlay pricing with Gaussian copula, LP vault | Fair parlay odds | EVM | Quant depth |
| OmniVerse | Arbitrum buildathon (HackQuest) | Submission | Fixes LP wipeout and liquidation cascades in PM-backed lending | No cascade at resolution | EVM | Risk engineering |
| Confimarket | May 2026 hackathon | 1st | Private institutional prediction markets | Hidden positions | Privacy chain | Institutional angle |
| Predix | HackQuest | Submission | Yield-backed PMs generated from tweets | Tweet becomes a market | EVM | AI market creation |
| Trixy | Flow, HackQuest | Submission | Yield-integrated PMs | Losers still earn yield | Flow | Yield angle |
| Dairy Price API x402 | Consensus Miami 2026 EasyA | Top, Coinbase/AWS track | Data API paid per call via x402 | Agent pays for data | x402 | Payments for data |
| Hedgehog Markets | Solana, 2021 | Prior art | Original no-loss prediction competitions | Win without risking capital | Solana | First mover |
| Smort | Solana, 2024 | Prior art | Lossless PM on a liquid staking token | Stake, predict, keep principal | Solana LST | LST yield funds prizes |

Not a hackathon, but the bar for "prediction markets on Solana": DFlow tokenizes every Kalshi market as SPL tokens (Dec 2025), and Jupiter Predict routes Polymarket. Not a hackathon, but the bar for "volatility for lending": Block Scholes and Chainlink sell implied-volatility feeds to lending protocols, sourced from **options** markets (BTC, ETH, a few majors only).

### What the benchmark says

- **No-loss prediction markets are saturated**: Hedgehog, Smort, PolyYield (won Best use of Solana), ExtraLife, EcoRound, Trixy, Predix. Knocked out.
- **Prediction market front-ends are saturated**: aggregators, social markets, word markets, news markets, AI-resolved markets (dozens at Chainlink alone).
- **What Colosseum funds in this space is PMs as building blocks for the rest of DeFi**: Senthos (structured products), Cesto (baskets), Vektar-style oracles. That's the open lane.
- Grand prizes go to infra with a hard number (TapeDrive "1,400x cheaper", Reflect).

## 2. Judges

No hackathon judge names are published. Finals are "a panel of industry leaders". What we know:

- **Track winners and overall winners: the UBC team** (student organizers, College.xyz nonprofit). Stated: "technical execution, product and UX, innovation, impact and potential, and demo."
- **Best use of Solana: Solana Foundation.** Stated: devnet is fine. Their recent hackathons (a dedicated Prediction Markets Hack, Mar 13 to 27, 2026, $30k) show prediction markets are a Solana priority. Assumed: they reward real programs over front-ends.
- **Gemini bounty: Gemini + a UBC rep.** Stated: "built on Gemini's prediction market APIs." Context: Gemini says it is now "focused on adding distribution partners" for its prediction markets (Q2 2026 earnings), signed an LOI with Apex Fintech (Aug 24, 2026), runs liquidity rewards and maker rebates, and published a public, no-key volume API. Assumed: they want their markets used and seen outside their own app.
- **QuickNode: QuickNode + a UBC rep.** Stated: Streams must be a core data source, not a side feature.
- The research competition at the same conference is judged by Franklin Templeton, No Limit Holdings, Collab + Currency, Blockworks, Portal Ventures and College.xyz. Assumed (not confirmed): some of these sit on the finals panel, which rewards a crisp investment-style thesis.

## 3. Sponsors and what they launched recently

- **Gemini Prediction Markets API**: public REST endpoints for events, contracts, live bid/ask, settlements (`resolutionSide`, `settlementValue`, `resolvedAt`), daily volume by category, combos; WebSocket price streams; sandbox. Trading is US-only (CFTC-regulated Gemini Titan), so we build on the public data.
- **Gemini market coverage (checked live Nov 11)**: about 1,000 active events. Up/down markets every 5 and 15 minutes, plus price ladders ("BTC $74,000 or above") for BTC, ETH, SOL, XRP, ZEC, HYPE from hourly to 19 days out; commodity ladders for silver, oil (WTI, Brent), natural gas, copper; weather; sports; economics (Fed decision in December, S&P end of year).
- **QuickNode Streams**: Solana devnet supported; free trial streams follow the chain tip in real time (no backfill); server-side JS filters; multiple destinations per stream (June 2026); KV store.
- **Solana**: prediction markets are a named priority; DFlow tokenized Kalshi; prop AMMs and lending (Kamino, Jupiter Lend) dominate DeFi; risk curators (Gauntlet, Galaxy, Hyperithm) run Kamino vaults.

## 4. Live data test (Nov 11, ~17:30 UTC)

We fitted a lognormal to each Gemini "X or above" ladder (two-sided quotes only, spread at most 15 cents, midpoints between 3% and 97%). No spot price input; the fit recovers the median and the volatility from the ladder alone.

| Ladder | Expiry from now | Points | Implied median | Gemini spot | Implied vol (annual) |
|---|---|---|---|---|---|
| BTC 1pm ET | 0.7 h | 8 | 74,270 | 74,340 | 39.7% |
| BTC Nov 11 | 4.7 h | 8 | 74,264 | 74,340 | 38.3% |
| BTC Nov 13 | 52.7 h | 13 | 74,280 | 74,340 | 35.5% |
| BTC Nov 30 | 460.7 h | 8 | 74,503 | 74,340 | 33.9% |
| SOL Nov 11 | 4.7 h | 5 | 85.02 | 85.10 | 57.8% |
| SOL Nov 13 | 52.7 h | 9 | 84.97 | 85.10 | 62.3% |
| ETH Nov 13 | 52.7 h | 7 | 2,082 | 2,085 | 50.0% |
| XRP Nov 30 | 460.7 h | 8 | 1.084 | n/a | 74.0% |
| ZEC Nov 11 | 4.7 h | 5 | 1,014 | n/a | 199.8% |
| Silver Nov 30 | 460.7 h | 7 | 52.21 | n/a | 37.7% |

Findings:
- The implied medians land within 0.1% of Gemini's spot price. The ladders are coherent.
- Gemini's ladders form a real **volatility term structure** across four expiries, including assets with **no crypto options market** (ZEC, silver, gas, copper). Correction, Nov 15: Deribit does list options on XRP and HYPE (its full list: BTC, ETH, SOL, HYPE, XRP, AVAX, TRX).
- Weakness: volume is thin (SOL ladders showed $0 traded today; BTC Nov 30 about $66k lifetime). Quotes exist, trades are rare. Any design must treat thin or stale ladders as low confidence and must not be exploitable by someone moving a quote.

## 5. Competitors in this event

Unknown: the Devpost gallery is blocked from here and the build starts Nov 13. Expect many entries copying the organizers' own example ("a DeFi prediction market built on Solana with Gemini's API"). Revisit from Oh-Jay's phone mid-week (Devpost gallery, Telegram, X posts tagged UBC).

## What winning looks like here

1. Not another prediction market app. The organizers published that recipe, so it will be crowded; stand out by making Gemini's markets an input to the rest of DeFi.
2. A real Solana program on devnet doing the core logic, with explorer links, plus a live URL a judge can open on a phone.
3. Gemini data that is essential: remove it and the product stops working.
4. QuickNode Streams carrying the product's history and alerts, visibly.
5. A thesis a teammate can pitch in 5 minutes in Austin, with one hard number on screen.

## One step further

Previous winners turned prediction markets into products (no-loss pools, social markets) or into DeFi building blocks via their own tokens (Senthos, Cesto). Go one step further: use a regulated prediction market as a **risk oracle**. Compute implied volatility from Gemini's ladders onchain, and let Solana lending markets tighten before volatility arrives. That covers assets options markets ignore, with a safety rule nobody else states: odds can only tighten limits, never liquidate anyone.

## Ideas

### Candidates (18)

| # | Idea | Knockout? |
|---|---|---|
| 1 | **Brace**: onchain implied-volatility oracle from Gemini ladders; lending pool's max LTV tightens before volatility arrives | Survives |
| 2 | Dynamic-fee AMM: LP fee rises with Gemini-implied vol (cuts arbitrage losses) | Survives |
| 3 | Covered-call vault for staked SOL, priced and settled by Gemini's SOL ladders | Survives (needs counterparties, seeded on devnet) |
| 4 | Parametric cover pool (weather, oil, crash) priced and settled by Gemini markets | Survives |
| 5 | Kamino liquidation-risk monitor: Gemini odds x real positions via Streams | Survives (read-only) |
| 6 | Event-conditional orders: escrow that swaps only if a Gemini event resolves a set way | Survives |
| 7 | Odds-weighted DAO treasury hedging vault (SOL/USDC split follows implied risk) | Survives |
| 8 | SOL volatility index token from Gemini term structure | Survives (needs counterparties) |
| 9 | Prediction-market odds oracle as pure infra (no consumer) | Survives |
| 10 | Gemini-settled two-party escrow bets | Survives, but Base Bets did it at MBC 2025 |
| 11 | No-loss prediction pool on LST yield (from the SolBlaze PDF) | **Out**: saturated (PolyYield, Hedgehog, Smort, ExtraLife, EcoRound) |
| 12 | Tokenized Gemini positions on Solana (DFlow-style) | **Out**: needs a US Gemini trading account, KYC, real funds |
| 13 | AI agent that trades Gemini markets for users | **Out**: trading is US-only |
| 14 | Leveraged Gemini positions | **Out**: needs real trading and liquidity |
| 15 | Stablecoin depeg cover | **Out**: Gemini lists no depeg markets |
| 16 | Conference markets for UBC itself | **Out** as a DeFi entry: Manifest did it at MBC 2025; Consumer track |
| 17 | Parlay builder on Gemini combos | **Out**: execution needs trading access |
| 18 | Market-maker rebate tracker for Gemini LPs | **Out**: needs authenticated Gemini accounts |

### Scores (1 to 5; criteria from the playbook, weighted toward UBC's five)

| Idea | Original | Problem | Tech depth | Ecosystem | UX | Execution in 7 days | Differentiation | Judge appeal | Long-term | Total /45 |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 Brace | 5 | 5 | 5 | 5 | 4 | 3 | 5 | 5 | 5 | **42** |
| 2 Dynamic-fee AMM | 4 | 4 | 5 | 4 | 3 | 3 | 4 | 3 | 4 | 34 |
| 4 Parametric cover | 3 | 4 | 3 | 4 | 4 | 4 | 3 | 4 | 3 | 32 |
| 3 Covered-call vault | 3 | 3 | 4 | 4 | 3 | 3 | 3 | 3 | 3 | 29 |
| 5 Liquidation monitor | 3 | 4 | 3 | 4 | 4 | 4 | 3 | 3 | 3 | 31 |
| 6 Conditional orders | 3 | 3 | 3 | 3 | 3 | 3 | 2 | 3 | 2 | 25 |
| 7 Treasury hedging | 2 | 3 | 3 | 3 | 3 | 4 | 2 | 2 | 3 | 25 |
| 8 Vol index token | 4 | 3 | 4 | 3 | 2 | 2 | 4 | 3 | 3 | 28 |
| 9 Pure odds oracle | 3 | 3 | 4 | 4 | 2 | 4 | 3 | 2 | 4 | 29 |
| 10 Escrow bets | 1 | 2 | 2 | 3 | 4 | 5 | 1 | 2 | 2 | 22 |

### Pressure test, top 3

**Brace.** Oracle: Gemini has no onchain feed, so a relayer posts raw quotes; the program does the math, so the relayer can't fake a volatility number, only misreport quotes (auditable against Gemini's public API). Thin liquidity: the program scores confidence from spread and point count, and falls back to the governance default when confidence is low. Manipulation: a moved quote can only lower LTV limits (griefing, not theft), because the program never raises limits above governance and never liquidates on odds. Indexer: QuickNode Streams, devnet supported. Paid tier: none needed for devnet. Approvals: none. Real liquidity: none needed. Remaining risk: scope (program + relayer + Streams + UI) alongside Holdfast. Re-score: 42 holds; execution stays a 3.

**Dynamic-fee AMM.** Same oracle. Extra blocker: proving LP benefit needs swap flow and a backtest, but there is no Gemini price history to backtest against. LVR is hard to explain to generalist judges in 5 minutes. Re-score: 33.

**Parametric cover.** Settlement from Gemini's `resolutionSide` works, but buying cover is functionally buying a YES contract, so judges will read it as a reskinned prediction market, which is the crowded lane. Underwriter liquidity must be seeded. Re-score: 30.

### Pick: Brace

Recommended plainly. It's the only candidate that uses Gemini's markets for something nobody can get elsewhere: forward-looking risk for assets with no options market, computed onchain on Solana. The live test above shows the ladders already produce sensible volatility for BTC, SOL, ETH, XRP, ZEC and silver. It sits in the DeFi track description word for word ("lending ... that compose with what already exists"), it makes Gemini essential, and it gives Streams a real job.
