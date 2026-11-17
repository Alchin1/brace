"use client";

import { MotionProvider } from "./MotionProvider";
import { PageTransition } from "./PageTransition";
import { Reveal, RevealGroup, RevealItem } from "./Reveal";

/* The optional motion versions, isolated so check/check.sh can measure what motion adds. */
export function DemoMotion() {
  return (
    <MotionProvider>
      <PageTransition>
        <Reveal>
          <h2 className="rv-h2">Every asset, every minute</h2>
        </Reveal>
        <RevealGroup className="rv-feed-grid">
          {["SOL", "BTC", "ETH", "XRP", "ZEC"].map((s) => (
            <RevealItem key={s}>{s}</RevealItem>
          ))}
        </RevealGroup>
      </PageTransition>
    </MotionProvider>
  );
}
