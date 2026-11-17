import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "Try a borrow" };

export default function BorrowPage() {
  return (
    <div className="page">
      <Link href="/" className="crumb text-link">
        All assets
      </Link>
      <h1>Try a borrow</h1>
      <p className="lede">Deposit devnet SOL and borrow test USD against the limit Brace sets onchain.</p>
      <div className="card placeholder" role="status">
        <p>The borrow flow ships next. It will use the same live limit shown here.</p>
        <p>
          A borrow above SOL&apos;s live limit will fail onchain. One under it will go through. Devnet only: test USD has no value and
          the demo pool charges no interest.
        </p>
      </div>
    </div>
  );
}
