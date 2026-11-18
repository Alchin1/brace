"use client";

import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { BraceGauge } from "./BraceGauge";
import { useFeedModel } from "./model";

/**
 * Borrow page head: the headline set big, and the live SOL line drawn under it
 * as a full-width brace from 0 to the limit. The figures themselves are in the
 * live strip below, so the gauge here is decorative.
 */
export function LineHead() {
  const m = useFeedModel("SOL");
  return (
    <header className="linehead">
      <Link href="/" className="crumb">
        <ArrowLeft size={16} aria-hidden /> Board
      </Link>
      <p className="phead-k">Borrow on devnet</p>
      <h1 className="lh-title">
        <span className="lh-w">Borrow up to</span> <span className="lh-w lh-pen">the line</span>
      </h1>
      <div className="lh-gauge">
        <BraceGauge limitBps={m.limit} capBps={m.cap} liqBps={m.liq} decorative />
      </div>
    </header>
  );
}
