import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { BraceMark } from "@/components/ui/BraceMark";
import { InstrumentField } from "@/components/ui/InstrumentField";
import { MiniBoard } from "@/components/ui/MiniBoard";

export const metadata: Metadata = { title: "Page not found" };

/** A miss drawn as a reading outside the expected band, with the live board underneath. */
export default function NotFound() {
  return (
    <section className="nf" aria-labelledby="nf-h">
      <InstrumentField variant="quiet" />
      <div className="nf-in">
        <div className="nf-plot" aria-hidden>
          <svg viewBox="0 0 400 160" width="100%" height="160">
            <rect x="120" y="10" width="160" height="130" className="nf-band" />
            <path d="M10 20 C150 20 170 140 390 140" className="nf-curve" />
            <line x1="10" x2="390" y1="140" y2="140" className="nf-axis" />
            <circle cx="350" cy="36" r="6" className="nf-dot" />
            <text x="350" y="22" textAnchor="middle" className="nf-lbl">
              you are here
            </text>
          </svg>
        </div>
        <p className="phead-k">
          <BraceMark size={18} open /> Error 404
        </p>
        <h1 id="nf-h" className="display-2">
          This page is outside the band.
        </h1>
        <p className="lede">There is nothing at this address. The live limits for SOL, BTC, ETH, XRP and ZEC are on the board.</p>
        <div className="actions">
          <Link href="/" className="btn btn-primary btn-lg">
            Back to the board <ArrowRight size={18} aria-hidden />
          </Link>
          <Link href="/borrow" className="text-link arrow-link">
            Try a borrow <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="nf-board card-lit">
          <p className="sheet-k">Live limits right now</p>
          <MiniBoard />
        </div>
      </div>
    </section>
  );
}
