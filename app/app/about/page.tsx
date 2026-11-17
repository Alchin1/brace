import type { Metadata } from "next";

export const metadata: Metadata = { title: "About" };

export default function AboutPage() {
  return (
    <div className="page prose">
      <h1>How Brace works</h1>
      <p className="lede">An onchain volatility oracle for Solana lending, built from Gemini prediction markets. UBC 2026 hackathon entry.</p>

      <p>
        Lending markets set loan-to-value limits by governance vote and change them rarely. When volatility jumps, the limits are
        still the calm-week numbers. Implied-volatility feeds from options markets mostly cover majors, and collateral like ZEC has no
        crypto options market at all.
      </p>
      <p>
        Gemini lists regulated &quot;X or above&quot; price ladders for BTC, ETH, SOL, XRP, ZEC and more, from hourly to multi-week
        expiries. A ladder is a market-implied probability curve, and a probability curve gives you implied volatility.
      </p>
      <p>
        A relayer reads Gemini&apos;s live ladders every minute and posts the raw quotes (strike, bid, ask, expiry, event ticker) to
        Solana devnet. It posts quotes, never conclusions.
      </p>
      <p>
        The Brace program filters the quotes, converts each midpoint to a z-score with a fixed lookup table, fits the curve by least
        squares, and stores implied volatility, a confidence flag and a max LTV per asset. All of this math runs onchain, so anyone can
        check it.
      </p>
      <p>
        Max LTV is the lower of the governance max and a volatility-adjusted limit. Stale or low-confidence data never loosens
        anything: Brace keeps the last valid limit and steps it down toward a conservative floor until fresh data arrives. A demo pool
        checks borrows and withdrawals against that limit; liquidation uses a fixed threshold only.
      </p>

      <h2>Known limitations</h2>
      <ul>
        <li>
          The relayer is trusted for quotes and spot. Mitigations: spot only moves on confident posts, must be within 3% of the
          ladder-implied median, and goes stale after 1 hour.
        </li>
        <li>
          <span className="mono">initialize</span> can be front-run between deploy and setup. Mitigation: deploy, initialize and
          init_pool run back to back from one script, then admin is verified onchain.
        </li>
        <li>Liquidation repays the full debt only (no partial liquidation). Test USD has no value.</li>
        <li>The check_borrow CPI for other lending programs was cut for time.</li>
        <li>Devnet only. No mainnet, no real funds, and the demo pool charges 0% interest.</li>
      </ul>
    </div>
  );
}
