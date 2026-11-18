import type { Metadata } from "next";
import { WalletShell } from "@/components/borrow/WalletShell";
import { PageHead } from "@/components/ui/PageHead";

export const metadata: Metadata = { title: "Try a borrow" };

export default function BorrowPage() {
  return (
    <div className="page borrow-page">
      <PageHead kicker="Borrow on devnet" title="Try a borrow" />
      <WalletShell />
    </div>
  );
}
