# Brace: build rules
Hackathon: UBC 2026 (DeFi & Onchain Apps + Best use of Solana + Gemini + QuickNode Streams). Submission closes: Fri Nov 20, 7:00 PM Lagos.
This repo is the source of truth. Every session: git pull, read docs/progress.md, then the next task in docs/plan.md. Use the hackathon-build skill (hackathon-ship near the deadline).
- One task at a time from docs/plan.md, in order. Test first, minimal code, run the gate, read the real output.
- Touch only the files the task declares. An out-of-scope change means the plan is wrong: fix the plan first.
- Never claim a pass you didn't run. Never weaken or skip a test.
- Debug from the error line and find the root cause before changing code. Two failures the same way means the task or spec is wrong.
- Boring, simple and deterministic beats clever.
- Devnet and burner wallets only. No keys, seeds or tokens in code, commits, logs or chat. Keypairs live outside the repo.
- Oh-Jay builds from his phone: every user-visible change ends with a "Do X, see Y" phone check.
- Update docs/progress.md and push after every task.
