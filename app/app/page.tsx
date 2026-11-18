import Link from "next/link";
import { ArrowDown, ArrowRight, Gauge, Hourglass, Sigma } from "lucide-react";
import { AssetList, HeroChart, HeroReading } from "@/components/Board";
import { HowItWorks } from "@/components/ui/HowItWorks";
import { InstrumentField } from "@/components/ui/InstrumentField";
import { LiveTape } from "@/components/ui/LiveTape";
import { ProofCard } from "@/components/ui/ProofCard";
import { SectionHead } from "@/components/ui/SectionHead";
import { SparkProvider } from "@/components/ui/Sparks";
import { CtaBand } from "@/components/ui/CtaBand";

/** The three guarantees. Sentences from the original "Why it holds up"; titles changed so none repeats a step. */
const GUARANTEES = [
  {
    icon: Sigma,
    title: "No offchain volatility number",
    body: "The relayer posts raw quotes. The program does the fit, so nobody can fake a volatility number.",
    viz: "fit",
  },
  {
    icon: Hourglass,
    title: "Silence tightens, never loosens",
    body: "Thin or stale data never loosens a limit. After an hour without fresh data, borrowing pauses.",
    viz: "step",
  },
  {
    icon: Gauge,
    title: "Odds never liquidate",
    body: "Liquidation uses only the fixed 80% threshold.",
    viz: "line",
  },
] as const;

function GuaranteeViz({ kind }: { kind: "fit" | "step" | "line" }) {
  if (kind === "fit")
    return (
      <svg viewBox="0 0 120 40" className="gviz" aria-hidden>
        {[10, 26, 42, 58, 74, 90, 106].map((x, i) => (
          <circle key={x} cx={x} cy={6 + 28 / (1 + Math.exp((i - 3) * 1.2))} r="2.2" className="gv-dot" />
        ))}
        <path d="M4 6 C40 6 50 34 116 34" className="gv-acc" />
      </svg>
    );
  if (kind === "step")
    return (
      <svg viewBox="0 0 120 40" className="gviz" aria-hidden>
        <path d="M4 10 H44 V18 H68 V26 H92 V32 H116" className="gv-acc" />
        <line x1="44" x2="44" y1="4" y2="36" className="gv-hair" />
      </svg>
    );
  return (
    <svg viewBox="0 0 120 40" className="gviz" aria-hidden>
      <path d="M4 30 C30 24 40 12 60 20 S96 8 116 14" className="gv-mute" />
      <line x1="4" x2="116" y1="8" y2="8" className="gv-acc" strokeDasharray="4 3" />
    </svg>
  );
}

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <InstrumentField variant="hero" />
        <div className="hero-copy">
          <p className="chips">
            <span className="chip chip-live">
              <span className="live-dot" aria-hidden />
              Live on Solana devnet
            </span>
            <span className="chip">UBC 2026</span>
          </p>
          <h1 id="hero-title" className="display">
            <span className="line">Lending limits</span> <span className="line">that move</span>{" "}
            <span className="line">
              <em>before</em> the market
            </span>{" "}
            <span className="line">does.</span>
          </h1>
          <div className="hero-sub">
            <p className="sub">
              Brace reads Gemini&apos;s regulated prediction markets every minute, computes implied volatility onchain on Solana, and sets
              how much you can borrow.
            </p>
            <div className="actions">
              <Link href="/borrow" className="btn btn-primary btn-lg">
                Try a borrow <ArrowRight size={18} aria-hidden />
              </Link>
              <a href="#how" className="text-link arrow-link">
                How it works <ArrowDown size={16} aria-hidden />
              </a>
            </div>
          </div>
        </div>
        <div className="hero-stage">
          <HeroChart />
          <SparkProvider symbols={["SOL"]} className="hero-kpis">
            <HeroReading />
          </SparkProvider>
        </div>
      </section>

      <LiveTape />

      <section className="section" aria-labelledby="assets-title" id="board">
        <SectionHead index="01" kicker="Live board" id="assets-title" title="Every asset, every minute" aside={<p>Read from Solana devnet every 15 seconds. Sparklines from the relayer&apos;s history.</p>} />
        <SparkProvider>
          <AssetList />
        </SparkProvider>
      </section>

      <section className="section" aria-labelledby="how-title" id="how">
        <SectionHead index="02" kicker="How the limit is set" id="how-title" title="From a price ladder to a borrow limit" />
        <HowItWorks />
      </section>

      <section className="section" aria-labelledby="g-title">
        <SectionHead index="03" kicker="Guarantees" id="g-title" title="Built to fail safe" />
        <div className="guarantees">
          {GUARANTEES.map((g, i) => (
            <article key={g.title} className={`gcard card-lit${i === 1 ? " is-raised" : ""}`} data-reveal>
              <span className="gcard-icon">
                <g.icon size={20} aria-hidden />
              </span>
              <h3>{g.title}</h3>
              <p>{g.body}</p>
              <GuaranteeViz kind={g.viz} />
            </article>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="proof-title">
        <SectionHead index="04" kicker="Proof" id="proof-title" title="Check the machine yourself" />
        <div className="proof-grid" data-reveal>
          <ul className="builton" aria-label="Built on">
            <li>
              <strong>Gemini</strong>
              <span>Regulated prediction market ladders</span>
            </li>
            <li>
              <strong>Solana</strong>
              <span>Program and accounts on devnet</span>
            </li>
            <li>
              <strong>QuickNode</strong>
              <span>Streams record every transaction</span>
            </li>
            <li>
              <strong>Cloudflare</strong>
              <span>Workers run the relayer</span>
            </li>
          </ul>
          <ProofCard />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
