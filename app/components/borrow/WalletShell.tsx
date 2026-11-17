"use client";

import { useCallback, useState } from "react";
import { ConnectionProvider, WalletProvider } from "@solana/wallet-adapter-react";
import type { WalletError } from "@solana/wallet-adapter-base";
import { DEFAULT_RPC } from "@/lib/brace";
import { BorrowApp } from "./BorrowApp";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC;

// No adapter list: Phantom and Solflare register through Wallet Standard and are detected automatically.
const WALLETS: never[] = [];

/** Wallet context for /borrow only, so the board pages stay light. */
export function WalletShell() {
  const [walletError, setWalletError] = useState<WalletError | null>(null);
  const onError = useCallback((e: WalletError) => setWalletError(e), []);
  const clear = useCallback(() => setWalletError(null), []);
  return (
    <ConnectionProvider endpoint={RPC_URL} config={{ commitment: "confirmed" }}>
      <WalletProvider wallets={WALLETS} autoConnect onError={onError}>
        <BorrowApp walletError={walletError} clearWalletError={clear} />
      </WalletProvider>
    </ConnectionProvider>
  );
}
