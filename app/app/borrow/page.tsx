import type { Metadata } from "next";
import { WalletShell } from "@/components/borrow/WalletShell";
import { LineHead } from "@/components/v2/LineHead";

export const metadata: Metadata = { title: "Try a borrow" };

export default function BorrowPage() {
  return (
    <div className="page wrap borrow-page">
      <LineHead />
      <WalletShell />
    </div>
  );
}
