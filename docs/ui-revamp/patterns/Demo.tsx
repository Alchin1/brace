"use client";

import { useEffect, useState } from "react";
import { CtaBand } from "./CtaBand";
import { FeedCard } from "./FeedCard";
import { SNAPSHOT, SNAPSHOT_CAPTURED_AT } from "./fixtures";
import { Hero } from "./Hero";
import { LiveTape, type TapeItem } from "./LiveTape";
import { NumberTicker } from "./NumberTicker";
import { PageTransitionCss } from "./PageEnter";
import { Reveal, RevealGroup } from "./RevealCss";
import { SectionHead } from "./SectionHead";
import { SegmentedControl } from "./SegmentedControl";
import { SiteFooter } from "./SiteFooter";
import { SiteNav, ThemeToggle } from "./SiteNav";
import { Skeleton } from "./Skeleton";
import { Sparkline } from "./Sparkline";
import { StepRail } from "./StepRail";
import { StickyActionBar } from "./StickyActionBar";
import { TxTimeline, type TxPhase } from "./TxTimeline";

/*
 * Every pattern composed into one Brace home page, using the real relayer snapshot in
 * fixtures.ts, with the default CSS-only motion. This is a reference for the UI bot, not app code: in the app, the numbers come
 * from useBoard() (devnet) and /history (relayer), and links use next/link.
 */

const PROGRAM_ID = "Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC";
const EXPLORER = `https://explorer.solana.com/address/${PROGRAM_ID}?cluster=devnet`;
const pct = (n: number) => `${n.toFixed(1)}%`;
const LINKS = [
  { href: "/", label: "Board" },
  { href: "/borrow", label: "Borrow" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About" },
];

type Sym = (typeof SNAPSHOT)[number]["symbol"];

export function Demo({ path = "/" }: { path?: string }) {
  const sol = SNAPSHOT.find((s) => s.symbol === "SOL")!;
  const [asset, setAsset] = useState<Sym>("SOL");
  const [phase, setPhase] = useState<TxPhase>("idle");
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const t = window.setTimeout(() => setLoading(false), 600);
    return () => window.clearTimeout(t);
  }, []);

  const tape: TapeItem[] = SNAPSHOT.map((s) => ({
    symbol: s.symbol,
    limitText: pct(s.limitPct),
    volText: pct(s.volPct),
    status: "live",
    href: `/asset/${s.symbol}`,
  }));
  const picked = SNAPSHOT.find((s) => s.symbol === asset)!;

  return (
    <>
      <SiteNav
        links={LINKS}
        path={path}
        brand={
          <a href="/">
            Brace <span className="rv-eyebrow">devnet</span>
          </a>
        }
        right={<ThemeToggle sun={<span aria-hidden>Light</span>} moon={<span aria-hidden>Dark</span>} />}
      />
      <PageTransitionCss>
        <main id="main">
          <div id="hero">
            <Hero
              eyebrow="Onchain volatility oracle on Solana devnet"
              titleLines={["Lending limits that move", "before the market does"]}
              sub="Brace reads Gemini's regulated prediction markets every minute, computes implied volatility onchain on Solana, and sets how much you can borrow."
              actions={
                <>
                  <a className="rv-btn rv-btn-primary" href="/borrow">
                    Try a borrow
                  </a>
                  <a className="rv-btn rv-btn-ghost" href="/about">
                    How it works
                  </a>
                </>
              }
              reading={
                <span style={{ display: "inline-flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
                  <span className="rv-dot" data-status="live" />
                  SOL limit {loading ? <Skeleton width="5ch" /> : <NumberTicker value={sol.limitPct} format={pct} label={`SOL limit ${pct(sol.limitPct)}`} />}
                  <span aria-hidden>·</span> implied vol <NumberTicker value={sol.volPct} format={pct} />
                </span>
              }
              visual={<div style={{ aspectRatio: "4 / 3", border: "1px solid var(--hair-2)", borderRadius: 14, background: "var(--card)" }}>LadderChart goes here</div>}
            />
          </div>

          <LiveTape items={tape} />

          <section className="rv-section rv-wrap" aria-labelledby="feeds-title">
            <SectionHead index="01" id="feeds-title" title="Every asset, every minute" aside="Snapshot from the live relayer" />
            <RevealGroup className="rv-feed-grid">
              {SNAPSHOT.map((s) => (
                <div key={s.symbol}>
                  <FeedCard
                    href={`/asset/${s.symbol}`}
                    symbol={s.symbol}
                    name={s.name}
                    limit={<NumberTicker value={s.limitPct} format={pct} />}
                    vol={pct(s.volPct)}
                    status="live"
                    statusText="live"
                    spark={<Sparkline points={s.sparkLimitPct} min={60} max={75} label={`${s.symbol} limit over the last 12 hours`} />}
                  />
                </div>
              ))}
            </RevealGroup>
          </section>

          <section className="rv-section rv-wrap" aria-labelledby="hist-title">
            <SectionHead index="02" id="hist-title" title="History" />
            <SegmentedControl
              label="Asset"
              value={asset}
              onChange={setAsset}
              options={SNAPSHOT.map((s) => ({ value: s.symbol, label: s.symbol }))}
            />
            <Reveal>
              <p style={{ marginTop: 16 }} className="rv-eyebrow">
                {picked.symbol} limit {pct(picked.limitPct)} at ts {SNAPSHOT_CAPTURED_AT}
              </p>
            </Reveal>
          </section>

          <section className="rv-section rv-wrap" aria-labelledby="how-title">
            <SectionHead index="03" id="how-title" title="How it works" />
            <StepRail
              label="How Brace works"
              steps={[
                { id: "s-read", title: "Read the market", body: "A relayer reads Gemini's live price ladders every minute and posts the raw quotes to Solana devnet." },
                { id: "s-fit", title: "Fit onchain", body: "The Brace program fits the curve, stores implied volatility, a confidence flag and a max LTV per asset." },
                { id: "s-limit", title: "Set the limit", body: "The demo pool checks every borrow against that limit. Stale data only ever tightens it." },
              ]}
            />
          </section>

          <section className="rv-section rv-wrap" aria-labelledby="tx-title">
            <SectionHead index="04" id="tx-title" title="Borrow progress" />
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
              {(["approve", "sent", "confirmed", "rejected", "expired"] as TxPhase[]).map((p) => (
                <button key={p} type="button" className="rv-btn rv-btn-ghost" onClick={() => setPhase(p)}>
                  {p}
                </button>
              ))}
            </div>
            <TxTimeline phase={phase} resultText="The program checked the live limit." />
          </section>

          <div className="rv-wrap">
            <CtaBand
              title="Try the over-limit borrow yourself"
              body="Connect Phantom on devnet, borrow past the live limit, and watch the program refuse it."
              actions={
                <a className="rv-btn rv-btn-primary" href="/borrow">
                  Try a borrow
                </a>
              }
            />
          </div>
        </main>
      </PageTransitionCss>
      <SiteFooter
        programId={PROGRAM_ID}
        explorerUrl={EXPLORER}
        note="Devnet build for UBC 2026. Test funds only."
        status={
          <>
            <span className="rv-dot" data-status="live" /> Relayer live (snapshot)
          </>
        }
        columns={[
          { title: "Product", links: LINKS },
          {
            title: "Proof",
            links: [
              { href: EXPLORER, label: "Program on Explorer", external: true },
              { href: "https://github.com/ohjay-official/brace", label: "GitHub", external: true },
              { href: "https://brace-relayer.ohjaye0.workers.dev/health", label: "Relayer health", external: true },
            ],
          },
          {
            title: "Built on",
            links: [
              { href: "https://www.gemini.com/predictions", label: "Gemini prediction markets", external: true },
              { href: "https://solana.com", label: "Solana", external: true },
              { href: "https://www.quicknode.com/streams", label: "QuickNode Streams", external: true },
            ],
          },
        ]}
      />
      <StickyActionBar watchId="hero">
        <span>
          SOL limit <strong>{pct(sol.limitPct)}</strong>
        </span>
        <a className="rv-btn rv-btn-primary" href="/borrow">
          Try a borrow
        </a>
      </StickyActionBar>
    </>
  );
}
