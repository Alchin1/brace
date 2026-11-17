import type { Metadata } from "next";
import Link from "next/link";
import { WalletShell } from "@/components/borrow/WalletShell";

export const metadata: Metadata = { title: "Try a borrow" };

export default function BorrowPage() {
  return (
    <div className="page">
      <Link href="/" className="crumb text-link">
        All assets
      </Link>
      <h1>Try a borrow</h1>
      <WalletShell />
    </div>
  );
}
