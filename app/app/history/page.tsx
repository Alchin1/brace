import type { Metadata } from "next";
import { HistoryView } from "@/components/HistoryView";
import { PageHead } from "@/components/ui/PageHead";

export const metadata: Metadata = { title: "History" };

export default function HistoryPage() {
  return (
    <div className="page wrap">
      <PageHead
        kicker="History"
        title="Every limit, every reject"
        lede={
          <>
            SOL&apos;s implied volatility and borrowing limit over the last 24 hours, plus every borrow the program accepted or rejected on
            devnet.
          </>
        }
      />
      <HistoryView />
    </div>
  );
}
