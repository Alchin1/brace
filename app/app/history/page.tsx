import type { Metadata } from "next";
import Link from "next/link";
import { HistoryView } from "@/components/HistoryView";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="page">
      <Link href="/" className="crumb text-link">
        All assets
      </Link>
      <h1>History</h1>
      <p className="lede">
        SOL&apos;s implied volatility and borrowing limit over the last 24 hours, plus every borrow the program accepted or
        rejected on devnet.
      </p>
      <HistoryView />
    </div>
  );
}
