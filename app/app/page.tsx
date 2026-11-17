import Link from "next/link";
import { AssetList, HeroChart, HeroReading } from "@/components/Board";

const WHY = [
  {
    title: "Math onchain",
    body: "The relayer posts raw quotes. The program does the fit, so nobody can fake a volatility number.",
  },
  {
    title: "Fails safe",
    body: "Thin or stale data never loosens a limit. After an hour without fresh data, borrowing pauses.",
  },
  {
    title: "Odds never liquidate",
    body: "Liquidation uses only the fixed 80% threshold.",
  },
];

export default function Home() {
  return (
    <>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <h1 id="hero-title">Lending limits that move before the market does</h1>
          <p className="sub">
            Brace reads Gemini&apos;s regulated prediction markets every minute, computes implied volatility onchain on Solana, and sets
            how much you can borrow.
          </p>
          <div className="hero-actions">
            <Link href="/borrow" className="btn btn-primary">
              Try a borrow
            </Link>
            <Link href="/about" className="text-link">
              How it works
            </Link>
          </div>
          <HeroReading />
        </div>
        <HeroChart />
      </section>

      <section className="section" aria-labelledby="assets-title">
        <div className="section-head">
          <h2 id="assets-title">Every asset, every minute</h2>
          <p>Read from Solana devnet every 15 seconds</p>
        </div>
        <AssetList />
      </section>

      <section className="section" aria-labelledby="why-title">
        <div className="section-head">
          <h2 id="why-title">Why it holds up</h2>
        </div>
        <div className="why">
          {WHY.map((w) => (
            <div key={w.title}>
              <h3>{w.title}</h3>
              <p>{w.body}</p>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
