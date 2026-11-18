"use client";

import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { feedEffectiveLtvBps } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { useBoard } from "../BoardProvider";
import { InstrumentField } from "./InstrumentField";
import { LimitRing } from "./Meters";
import { RollingNumber } from "./RollingNumber";

/** Closing panel: one action, with the live SOL limit it will be checked against. */
export function CtaBand({ secondary = { href: "/history", label: "See past rejects" } }: { secondary?: { href: string; label: string } }) {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok?.feeds.SOL ?? null;
  const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
  const cap = ok?.config.params.govMaxLtvBps ?? 7500;
  const liq = ok?.config.params.liqThresholdBps ?? 8000;
  return (
    <section className="cta" aria-labelledby="cta-h" data-reveal>
      <InstrumentField variant="panel" />
      <div className="cta-in">
        <div className="cta-copy">
          <h2 id="cta-h">Try to borrow past the limit.</h2>
          <p>
            Connect Phantom on devnet, push the borrow past the live limit, and watch the program refuse it onchain. Test funds only.
          </p>
          <div className="actions">
            <Link href="/borrow" className="btn btn-primary btn-lg">
              Try a borrow <ArrowRight size={18} aria-hidden />
            </Link>
            <Link href={secondary.href} className="text-link arrow-link">
              {secondary.label} <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
        <div className="cta-ring">
          <LimitRing
            limitBps={limit}
            capBps={cap}
            liqBps={liq}
            size={196}
            center={<span className="ring-v">{limit === null ? "--" : <RollingNumber value={pct1(limit)} />}</span>}
            sub="SOL limit right now"
          />
        </div>
      </div>
    </section>
  );
}
