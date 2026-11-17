import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="page">
      <Link href="/" className="crumb text-link">
        All assets
      </Link>
      <h1>History</h1>
      <p className="lede">Every volatility update, blocked borrow and liquidation Brace records on devnet.</p>
      <div className="card placeholder" role="status">
        <p>History arrives with QuickNode Streams.</p>
        <p>
          Nothing is shown here until the stream is connected. For the current numbers, see the{" "}
          <Link href="/" className="text-link" style={{ textDecoration: "underline", textUnderlineOffset: 4 }}>
            live board
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
