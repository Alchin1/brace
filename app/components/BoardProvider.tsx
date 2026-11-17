"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_RPC, fetchBoard, type BoardState } from "@/lib/brace";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC;
const POLL_MS = 15_000;

type Ctx = { state: BoardState | null; now: number };
const BoardContext = createContext<Ctx>({ state: null, now: 0 });

export function BoardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BoardState | null>(null);
  const [now, setNow] = useState(0);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const s = await fetchBoard(RPC_URL);
      if (!alive) return;
      // Keep the last good read if one refresh fails; the age labels keep counting.
      setState((prev) => (s.kind === "error" && prev?.kind === "ok" ? prev : s));
    };
    load();
    const poll = setInterval(load, POLL_MS);
    setNow(Math.floor(Date.now() / 1000));
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      alive = false;
      clearInterval(poll);
      clearInterval(tick);
    };
  }, []);

  return <BoardContext.Provider value={{ state, now }}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  return useContext(BoardContext);
}

export function BoardNotice({ state }: { state: BoardState | null }) {
  if (state === null) {
    return (
      <div className="notice" role="status">
        <strong>Reading devnet</strong>
        <span className="muted">Loading the Brace accounts from Solana devnet.</span>
      </div>
    );
  }
  if (state.kind === "not-deployed") {
    return (
      <div className="notice" role="status">
        <strong>Program not deployed on devnet yet</strong>
        <span className="muted">No numbers are shown until the Brace program is live. This page checks again every 15 seconds.</span>
      </div>
    );
  }
  if (state.kind === "not-initialized") {
    return (
      <div className="notice" role="status">
        <strong>Program deployed, not set up yet</strong>
        <span className="muted">The Brace config account does not exist on devnet yet. This page checks again every 15 seconds.</span>
      </div>
    );
  }
  if (state.kind === "error") {
    return (
      <div className="notice" role="alert">
        <strong>Could not reach the devnet RPC</strong>
        <span className="muted">Retrying every 15 seconds. Error: {state.message}</span>
      </div>
    );
  }
  return null;
}
