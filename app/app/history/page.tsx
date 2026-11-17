import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <>
      <Link href="/" className="back">
        Back to board
      </Link>
      <h1>History</h1>
      <div className="notice" role="status">
        <strong>History arrives with QuickNode Streams</strong>
        <span className="muted">
          A QuickNode Stream will record every Brace volatility update, blocked borrow and liquidation on devnet. This page will show
          that timeline once it is connected. Nothing is shown here until then.
        </span>
      </div>
      <p className="muted">
        For the current numbers, see the <Link href="/">risk board</Link>.
      </p>
    </>
  );
}
