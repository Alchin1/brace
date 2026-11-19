import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { MiniBoard } from "@/components/ui/MiniBoard";

export const metadata: Metadata = { title: "Page not found", alternates: { canonical: null }, robots: { index: false } };

const RUNGS = ["a", "b", "c", "404", "d", "e", "f"];

/** A ladder with one rung missing: the address you asked for. */
export default function NotFound() {
  return (
    <section className="nf wrap" aria-labelledby="nf-h">
      <ol className="nf-ladder" aria-hidden>
        {RUNGS.map((r, i) => (
          <li key={r} className={r === "404" ? "is-gone" : undefined} style={{ "--i": i } as React.CSSProperties}>
            <span>{r === "404" ? "404" : ""}</span>
            <i />
          </li>
        ))}
      </ol>
      <div className="nf-copy">
        <p className="phead-k">Error 404</p>
        <h1 id="nf-h" className="display-2">
          No rung at this address
        </h1>
        <p className="lede">There is nothing here. The live limits for SOL, BTC, ETH, XRP and ZEC are on the board.</p>
        <div className="actions">
          <Link href="/" className="btn btn-primary btn-lg">
            Back to the board <ArrowRight size={18} aria-hidden />
          </Link>
          <Link href="/borrow" className="text-link arrow-link">
            Try a borrow <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <div className="nf-board">
          <p className="sheet-k">Live limits right now</p>
          <MiniBoard />
        </div>
      </div>
    </section>
  );
}
