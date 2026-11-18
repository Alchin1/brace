import type { Metadata } from "next";
import { CtaBand } from "@/components/ui/CtaBand";
import { PageHead } from "@/components/ui/PageHead";
import { ProofCard } from "@/components/ui/ProofCard";

export const metadata: Metadata = { title: "About" };

const SECTIONS = [
  { id: "problem", n: "01", t: "The problem" },
  { id: "signal", n: "02", t: "The signal" },
  { id: "system", n: "03", t: "The system" },
  { id: "limit", n: "04", t: "The limit" },
  { id: "limits", n: "05", t: "Known limitations" },
];

/** Gemini to relayer to program to pool, with Streams feeding History. Text alternative below. */
function SystemDiagram() {
  const nodes = [
    { x: 8, t: "Gemini", s: "price ladders" },
    { x: 206, t: "Relayer", s: "posts raw quotes" },
    { x: 404, t: "Brace program", s: "fits vol, sets limit" },
    { x: 602, t: "Demo pool", s: "checks every borrow" },
  ];
  return (
    <figure className="diagram card-lit">
      <svg viewBox="0 0 790 190" width="100%" role="img" aria-labelledby="diag-desc">
        <defs>
          <marker id="arr" viewBox="0 0 8 8" refX="7" refY="4" markerWidth="8" markerHeight="8" orient="auto">
            <path d="M0 0L8 4L0 8z" className="dg-arrowhead" />
          </marker>
        </defs>
        {nodes.map((n, i) => (
          <g key={n.t}>
            <rect x={n.x} y="24" width="180" height="76" rx="12" className={`dg-node${i === 2 ? " is-key" : ""}`} />
            <text x={n.x + 18} y="56" className="dg-t">
              {n.t}
            </text>
            <text x={n.x + 18} y="80" className="dg-s">
              {n.s}
            </text>
            {i < nodes.length - 1 && <line x1={n.x + 184} x2={n.x + 202} y1="62" y2="62" className="dg-line" markerEnd="url(#arr)" />}
          </g>
        ))}
        <path d="M494 104 V150 H260" className="dg-line dashed" markerEnd="url(#arr)" />
        <rect x="70" y="128" width="186" height="44" rx="10" className="dg-node" />
        <text x="88" y="155" className="dg-s">
          QuickNode Streams to History
        </text>
        <text x="300" y="168" className="dg-k">
          every transaction, rejects included
        </text>
      </svg>
      <figcaption id="diag-desc">
        Gemini price ladders go to a relayer, which posts raw quotes to the Brace program on Solana devnet. The program fits implied
        volatility and sets a limit that the demo pool checks on every borrow. QuickNode Streams records every program transaction for the
        History page.
      </figcaption>
    </figure>
  );
}

export default function AboutPage() {
  return (
    <div className="page about">
      <PageHead
        kicker="UBC 2026 hackathon entry"
        title="How Brace works"
        lede="An onchain volatility oracle for Solana lending, built from Gemini prediction markets."
      />

      <div className="about-grid">
        <nav className="about-index" aria-label="On this page">
          <ol>
            {SECTIONS.map((s) => (
              <li key={s.id}>
                <a href={`#${s.id}`}>
                  <span>{s.n}</span>
                  {s.t}
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="about-body prose">
          <section id="problem" data-reveal>
            <p className="ab-n">01 The problem</p>
            <p>
              Lending markets set loan-to-value limits by governance vote and change them rarely. When volatility jumps, the limits are
              still the calm-week numbers. Implied-volatility feeds from options markets mostly cover majors, and collateral like ZEC has no
              crypto options market at all.
            </p>
          </section>

          <section id="signal" data-reveal>
            <p className="ab-n">02 The signal</p>
            <p>
              Gemini lists regulated &quot;X or above&quot; price ladders for BTC, ETH, SOL, XRP, ZEC and more, from hourly to multi-week
              expiries. A ladder is a market-implied probability curve, and a probability curve gives you implied volatility.
            </p>
          </section>

          <section id="system" data-reveal>
            <p className="ab-n">03 The system</p>
            <SystemDiagram />
            <p>
              A relayer reads Gemini&apos;s live ladders every minute and posts the raw quotes (strike, bid, ask, expiry, event ticker) to
              Solana devnet.
            </p>
            <blockquote className="pull">It posts quotes, never conclusions.</blockquote>
            <p>
              The Brace program filters the quotes, converts each midpoint to a z-score with a fixed lookup table, fits the curve by least
              squares, and stores implied volatility, a confidence flag and a max LTV per asset. All of this math runs onchain, so anyone
              can check it.
            </p>
          </section>

          <section id="limit" data-reveal>
            <p className="ab-n">04 The limit</p>
            <p>
              Max LTV is the lower of the governance max and a volatility-adjusted limit. Stale or low-confidence data never loosens
              anything: Brace keeps the last valid limit and steps it down toward a conservative floor until fresh data arrives. A demo
              pool checks borrows and withdrawals against that limit; liquidation uses a fixed threshold only.
            </p>
            <ProofCard />
          </section>

          <section id="limits" data-reveal>
            <p className="ab-n">05 Known limitations</p>
            <ul className="limits-list">
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
          </section>
        </div>
      </div>

      <CtaBand secondary={{ href: "/", label: "Back to the board" }} />
    </div>
  );
}
