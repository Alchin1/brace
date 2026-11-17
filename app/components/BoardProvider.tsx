"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { DEFAULT_RPC, fetchBoard, type BoardState } from "@/lib/brace";

const RPC_URL = process.env.NEXT_PUBLIC_RPC_URL || DEFAULT_RPC;
const POLL_MS = 15_000;

type Ctx = { state: BoardState | null; now: number; retry: () => void; retrying: boolean };
const BoardContext = createContext<Ctx>({ state: null, now: 0, retry: () => {}, retrying: false });

export function BoardProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<BoardState | null>(null);
  const [now, setNow] = useState(0);
  const [retrying, setRetrying] = useState(false);

  const load = useCallback(async () => {
    const s = await fetchBoard(RPC_URL);
    // Keep the last good read if one refresh fails; the age labels keep counting.
    setState((prev) => (s.kind === "error" && prev?.kind === "ok" ? prev : s));
  }, []);

  const retry = useCallback(() => {
    setRetrying(true);
    load().finally(() => setRetrying(false));
  }, [load]);

  useEffect(() => {
    load();
    const poll = setInterval(load, POLL_MS);
    setNow(Math.floor(Date.now() / 1000));
    const tick = setInterval(() => setNow(Math.floor(Date.now() / 1000)), 1000);
    return () => {
      clearInterval(poll);
      clearInterval(tick);
    };
  }, [load]);

  return <BoardContext.Provider value={{ state, now, retry, retrying }}>{children}</BoardContext.Provider>;
}

export function useBoard() {
  return useContext(BoardContext);
}

/** Retry button for a failed devnet read. */
export function RetryButton() {
  const { retry, retrying } = useBoard();
  return (
    <button type="button" className="btn btn-secondary" onClick={retry} disabled={retrying}>
      {retrying ? "Trying again…" : "Try again"}
    </button>
  );
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
        <strong>Live limits are not loading</strong>
        <span className="muted">{state.message} The page tries again every 15 seconds, or you can try now.</span>
        <div className="notice-actions">
          <RetryButton />
        </div>
      </div>
    );
  }
  return null;
}
