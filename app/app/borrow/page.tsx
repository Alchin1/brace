import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Try a borrow" };

export default function BorrowPage() {
  return (
    <>
      <Link href="/" className="back">
        Back to board
      </Link>
      <h1>Try a borrow</h1>
      <div className="notice" role="status">
        <strong>Coming next</strong>
        <span className="muted">
          The borrow flow is not built yet. When it ships you will connect a devnet wallet, deposit devnet SOL and borrow test USD.
          A borrow above SOL&apos;s live limit will fail onchain with RiskTightened; one under it will go through.
        </span>
      </div>
      <p className="muted">Devnet only. Test USD has no value and the demo pool charges no interest.</p>
    </>
  );
}
