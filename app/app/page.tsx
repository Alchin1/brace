import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { LadderRungs, Worksheet } from "@/components/v2/Ladder";
import { ProofLog } from "@/components/v2/ProofLog";
import { Recorder } from "@/components/v2/Recorder";
import { StepDown } from "@/components/v2/Rules";
import { Stage } from "@/components/v2/Stage";

export default function Home() {
  return (
    <>
      <Stage symbol="SOL" id="hero-title">
        <p className="kick">Solana devnet, UBC 2026</p>
        <h1 id="hero-title" className="display">
          Lending limits that move <span className="pen">before</span> the market does
        </h1>
        <p className="lede">
          Brace reads the strike ladders on Gemini&apos;s prediction markets, fits implied volatility onchain on Solana, and sets how much
          you can borrow.
        </p>
        <div className="actions">
          <Link href="/borrow" className="btn btn-primary btn-lg">
            Try a borrow <ArrowRight size={18} aria-hidden />
          </Link>
          <a href="#ladder" className="text-link arrow-link">
            Read the ladder <ArrowDown size={16} aria-hidden />
          </a>
        </div>
      </Stage>

      <section className="band" aria-labelledby="rec-title" id="board">
        <div className="wrap">
          <header className="shead">
            <p className="shead-k">Recorder, 5 channels</p>
            <h2 id="rec-title">Five limits, traced for 24 hours</h2>
            <p className="shead-d">
              Each line is the limit the program held for that asset, posted by the relayer. One scale for all five, so a dip is a real dip.
              Gaps are hours with no posts.
            </p>
          </header>
          <Recorder />
        </div>
      </section>

      <section className="band ink" aria-labelledby="ladder-title" id="ladder">
        <div className="wrap">
          <header className="shead">
            <p className="shead-k">SOL, right now</p>
            <h2 id="ladder-title">From a ladder of strikes to one number</h2>
            <p className="shead-d">
              Gemini traders price the chance SOL ends above each strike. The program fits a volatility to those prices and turns it into the
              limit, in five steps you can check.
            </p>
          </header>
          <div className="ladder-grid">
            <LadderRungs symbol="SOL" />
            <Worksheet symbol="SOL" />
          </div>
        </div>
      </section>

      <section className="band" aria-labelledby="rules-title">
        <div className="wrap">
          <header className="shead">
            <p className="shead-k">Three rules in the program</p>
            <h2 id="rules-title">It only ever tightens on its own</h2>
          </header>
          <ol className="rules">
            <li>
              <span className="r-n">R1</span>
              <h3>The fit happens onchain</h3>
              <p>The relayer posts raw quotes, never a volatility number. The program does the fit, so nobody can hand it a convenient answer.</p>
            </li>
            <li className="r-wide">
              <span className="r-n">R2</span>
              <h3>Silence steps the limit down</h3>
              <p>Thin or stale data never loosens a limit. Here is the SOL limit if the relayer went quiet now, from the program&apos;s own rule.</p>
              <StepDown />
            </li>
            <li>
              <span className="r-n">R3</span>
              <h3>Odds never liquidate</h3>
              <p>The odds only set how much you can borrow. Liquidation uses the fixed threshold in the config and nothing else.</p>
            </li>
          </ol>
        </div>
      </section>

      <section className="band" aria-labelledby="proof-title">
        <div className="wrap">
          <header className="shead">
            <p className="shead-k">Proof</p>
            <h2 id="proof-title">Every number has a transaction behind it</h2>
          </header>
          <ProofLog />
        </div>
      </section>

      <section className="closer" aria-labelledby="close-title">
        <div className="wrap closer-grid">
          <div className="closer-in">
            <h2 id="close-title">Now try to borrow past the line</h2>
            <p>Borrow over the live limit and the program refuses it onchain with error 6005, RiskTightened. It costs devnet SOL only.</p>
            <Link href="/borrow" className="btn btn-primary btn-lg">
              Try a borrow <ArrowRight size={18} aria-hidden />
            </Link>
          </div>
          <div className="stamp" aria-hidden>
            <span className="stamp-k">Blocked by the program</span>
            <span className="stamp-code">6005</span>
            <span className="stamp-k">RiskTightened</span>
          </div>
        </div>
      </section>
    </>
  );
}
