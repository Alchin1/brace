"use client";

import { useEffect, useState } from "react";
import { HistoryChart } from "@/components/HistoryChart";
import { fetchWithTimeout, friendlyNetError } from "@/lib/net";
import {
  HISTORY_WINDOW_SECS,
  RELAYER_URL,
  actionsUrl,
  borrowActions,
  formatBorrowAction,
  historyUrl,
  parseActions,
  parseHistory,
  seriesForChart,
  type ActionRecord,
  type ChartPoint,
} from "@/lib/history";

type LoadState = "loading" | "ok" | "error";

class HttpError extends Error {}

const POLL_MS = 30_000;

export function HistoryView() {
  const [status, setStatus] = useState<LoadState>("loading");
  const [error, setError] = useState<string | null>(null);
  const [points, setPoints] = useState<ChartPoint[]>([]);
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [bounds, setBounds] = useState<{ t0: number; t1: number } | null>(null);

  useEffect(() => {
    let alive = true;
    const load = async () => {
      const now = Math.floor(Date.now() / 1000);
      const since = now - HISTORY_WINDOW_SECS;
      try {
        const [histRes, actRes] = await Promise.all([
          fetchWithTimeout(historyUrl("SOL", since)),
          fetchWithTimeout(actionsUrl(since)),
        ]);
        if (!histRes.ok || !actRes.ok) throw new HttpError();
        const [histBody, actBody] = await Promise.all([histRes.json(), actRes.json()]);
        const rows = parseHistory(histBody);
        const acts = parseActions(actBody);
        if (!alive) return;
        setPoints(seriesForChart(rows, now));
        setActions(borrowActions(acts));
        setBounds({ t0: since, t1: now });
        setError(null);
        setStatus("ok");
      } catch (e) {
        if (!alive) return;
        setError(e instanceof HttpError ? "The history service sent back an error." : friendlyNetError(e, "the history service"));
        setStatus((prev) => (prev === "ok" ? "ok" : "error"));
      }
    };
    load();
    const t = setInterval(load, POLL_MS);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const t0 = bounds?.t0 ?? Math.floor(Date.now() / 1000) - HISTORY_WINDOW_SECS;
  const t1 = bounds?.t1 ?? Math.floor(Date.now() / 1000);
  const chartStatus = status === "error" && !points.length ? "error" : status === "loading" && !points.length ? "loading" : "ok";
  const formatted = actions.map(formatBorrowAction);

  return (
    <div className="history">
      <HistoryChart points={points} t0={t0} t1={t1} status={chartStatus} />

      <section className="history-actions" aria-labelledby="borrows-h">
        <h2 id="borrows-h">Blocked and allowed borrows</h2>
        {status === "loading" && !formatted.length ? (
          <p className="muted">Reading Streams.</p>
        ) : status === "error" && !formatted.length ? (
          <p className="muted">
            Could not load borrows. {error ?? ""} This page tries again every 30 seconds.
          </p>
        ) : formatted.length === 0 ? (
          <p className="muted">
            No borrows have been recorded yet. Blocked and allowed borrows will appear here once someone uses the
            demo pool.
          </p>
        ) : (
          <ul className="recent-list">
            {formatted.map((row) => (
              <li key={`${row.href}-${row.ts}`}>
                <span className={`dot ${row.ok ? "live" : "none"}`} aria-hidden />
                <div className="recent-body">
                  <span className="recent-label">
                    {row.label}: {row.detail}
                  </span>
                  <span className="recent-msg">{row.when}</span>
                </div>
                <a className="text-link recent-link" href={row.href} target="_blank" rel="noopener noreferrer">
                  Explorer
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="history-source">
        Recorded by QuickNode Streams from every Brace transaction on devnet.{" "}
        <a className="text-link u" href={`${RELAYER_URL}/history?asset=SOL`} target="_blank" rel="noopener noreferrer">
          Raw /history
        </a>
      </p>
    </div>
  );
}
