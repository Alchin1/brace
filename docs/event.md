# UBC 2026 Hackathon: rules file

Source timezone is CST (UTC-6, US daylight saving ended Nov 1). Lagos is WAT (UTC+1), so Lagos = CST + 7 hours.

## Key dates in Lagos time

| What | CST (source) | Lagos (WAT) |
|---|---|---|
| Travel grant applications close | Nov 13 | Nov 13 |
| Kickoff call, hacking starts | Thu Nov 12, 6:00 PM | **Fri Nov 13, 1:00 AM** |
| Teammate gate (our rule) | n/a | **End of Fri Nov 13** |
| Office hours: Solana + Circle (then TBD) | Mon Nov 16, 6:00 to 8:00 PM | Tue Nov 17, 1:00 to 3:00 AM |
| Office hours: Solana + Cursor | Tue Nov 17, 6:00 to 7:00 PM | Wed Nov 18, 1:00 to 2:00 AM |
| Office hours: **Gemini (Prediction Markets)** + Circle | Wed Nov 18, 6:00 to 7:00 PM | **Thu Nov 19, 1:00 to 2:00 AM** |
| Office hours: Solana + **QuickNode** | Thu Nov 19, 6:00 to 7:00 PM | Fri Nov 20, 1:00 to 2:00 AM |
| **Submission deadline (Devpost)** | Fri Nov 20, 12:00 PM | **Fri Nov 20, 7:00 PM** |
| Finalists notified | by midnight Nov 20 | by Sat Nov 21, 7:00 AM |
| Finals, live pitches at UT Austin; closing ceremony | Sat Nov 21 | Sat Nov 21 |

Overlap warning: BCH BLAZE (Holdfast) builds Nov 14 to 22 and closes Nov 22, 3:00 PM Lagos. UBC closes two days earlier.

## Eligibility

- Build from anywhere. Teams of 1 to 4 recommended; solo allowed.
- **You must be at the UBC closing ceremony in Austin to win any prize, including bounties.** (FAQ 05)
- You must be registered for UBC 2026 (Luma ticket) to compete. (Hackathon page footer)
- No pre-started projects: "Projects need to be substantially built during the hackathon week." (FAQ 01)
- Students only? Not stated for the hackathon. The research competition is students-only; the hackathon page says "Seasoned dev or first hackathon, there's a place for you here." Ask.
- No KYC or age rule stated.

## Tracks and prizes

Enter exactly one main track. Then optionally one chain award (Solana or Arc, not both) and any bounties you qualify for. All prizes stack.

| Prize | Amount | Chosen by | Requirement |
|---|---|---|---|
| Track winner: Agentic Payments & AI | $2,000 | UBC team | "Give AI agents wallets, budgets, and guardrails so they can pay for APIs, data, and compute." Any chain |
| **Track winner: DeFi & Onchain Apps** (our track) | $2,000 | UBC team | "New financial primitives (exchanges, lending, yield, payments) that compose with what already exists." Any chain |
| Track winner: Consumer Apps | $2,000 | UBC team | Crypto invisible; working frontend required |
| **Best use of Solana** (per track) | $1,500 | Solana | Built on Solana; devnet is fine |
| Best use of Arc (per track) | $1,000 | Circle | Built on Arc; testnet is fine (excluded: we take Solana) |
| **Gemini Prediction Markets bounty** | 1st $2,500, 2nd $1,000, 3rd $500 | Gemini + UBC rep | "Projects built on Gemini's prediction market APIs" |
| **QuickNode Streams bounty** | $500 | QuickNode + UBC rep | "Projects that use QuickNode Streams as a core data source" |
| ElevenLabs bounty | 3 months Scale per member | ElevenLabs + UBC rep | Voice or audio is central (not targeting) |
| Grok Bot bounty | Mechanical keyboard per member + swag | Grok Bot + UBC rep | Grok Bot does real work (not targeting) |
| Official UBC winner (all submissions) | 1st $2,500 (+3 months ElevenLabs Pro per member), 2nd $1,000, 3rd $500 | UBC team | Any |
| Participation perks | 1 month ElevenLabs Creator; QuickNode $49/mo plan and X Premium (first 300) | n/a | Complete, working submission |

Organizers' own stacking example: "A DeFi prediction market built on Solana with Gemini's API could win all four" = $8,500. Adding QuickNode Streams makes the ceiling $9,000.

## Judging criteria (quoted, FAQ 06)

"Projects are judged on technical execution, product and UX, innovation, impact and potential, and demo."

- No weights published. Treat all five as equal.
- "Up to 13 teams pitch live for 5 minutes, plus 2 minutes of Q&A: 3 from each main track (the top contenders for Track Winner, Best use of Solana, and Best use of Arc), the top 3 overall contenders, and the 1st-place Gemini team."
- Finalists pitch "to a panel of industry leaders". No judge names published for the hackathon.

## Submission (FAQ 04)

- Devpost: project name, description, team.
- Public GitHub repo.
- Working demo or deployed app.
- **2 to 3 minute demo video.**
- README with technical docs.
- "Some tracks ask for extras, like a contract address." Details are in the hackathon guide (Google Doc, blocked from Claude's side: Oh-Jay to paste).
- Submit via ubc-hackathon-2026.devpost.com.

## AI use and third-party disclosure

- "Yes, AI tools are encouraged. You keep all rights to your code and IP." (FAQ 07)
- No disclosure rule stated. We disclose AI use and third-party libraries in the README anyway.

## Required tech

- Solana: Solana devnet program (Anchor). Devnet is accepted.
- Gemini: Gemini Prediction Markets API (public market data endpoints need no key; trading is US-only, so no trading).
- QuickNode: Streams on Solana devnet (supported network) as a core data source.

## Disqualifiers and prize blockers

- Project substantially built before Nov 12, 6:00 PM CST.
- Entering more than one main track, or both chain awards.
- Not registered for UBC 2026 on Luma.
- Nobody from the team at the closing ceremony in Austin: no prize of any kind.

## Ask the organizers (Telegram)

1. If one teammate attends the closing ceremony, can remote international teammates still share track and bounty prizes?
2. Can prizes be paid directly to each team member's wallet?
3. Is the hackathon limited to students?
4. Does a remote teammate also need a UBC 2026 Luma ticket?

## Ask at Gemini office hours (Thu Nov 19, 1:00 AM Lagos)

1. Does building on the public market data endpoints (events, prices, settlements) count for the bounty, given trading is US-only?
2. Any restriction on publishing derived values (implied volatility) from Gemini market data onchain?

## Sources

- https://www.universityblockchain.org/programs/hackathon (page and its script bundle: tracks, prizes, FAQ answers)
- https://www.universityblockchain.org/travel-grants
- Office hours schedule pasted by Oh-Jay (from the UBC workshop doc)
- Prize card screenshots sent by Oh-Jay
- https://developer.gemini.com/products/prediction-markets
