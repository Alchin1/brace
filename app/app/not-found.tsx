import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <section className="not-found">
      <h1>Page not found</h1>
      <p>There is nothing at this address. The live limits for SOL, BTC, ETH, XRP and ZEC are on the board.</p>
      <div className="hero-actions">
        <Link href="/" className="btn btn-primary">
          Back to the board
        </Link>
      </div>
    </section>
  );
}
