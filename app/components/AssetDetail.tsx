"use client";

import Link from "next/link";
import {
  explorerAddress,
  feedEffectiveLtvBps,
  feedPda,
  feedStatus,
  fromE6,
  pctFromBps,
  relTime,
  untilTime,
  type Symbol,
} from "@/lib/brace";
import { BoardNotice, useBoard } from "./BoardProvider";
import { StatusCell } from "./Board";

function horizonLabel(secs: number): string {
  if (secs % 3600 === 0) return `${secs / 3600}h`;
  return `${Math.round(secs / 60)}m`;
}

export function AssetDetail({ symbol }: { symbol: Symbol }) {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok ? ok.feeds[symbol] : null;
  const pda = feedPda(symbol).toBase58();

  const rows: [string, React.ReactNode][] =
    ok && f
      ? [
          ["Status", <StatusCell key="s" status={feedStatus(f, ok.config.params, now)} />],
          ["Spot", <span key="v" className="mono">${fromE6(f.spotE6)}</span>],
          ["Implied median", <span key="v" className="mono">${fromE6(f.medianE6)}</span>],
          ["Implied vol (annualised)", <span key="v" className="mono">{pctFromBps(f.sigmaBps)}</span>],
          [
            `${horizonLabel(ok.config.params.horizonSecs)} move (1 sigma)`,
            <span key="v" className="mono">{(Number(f.horizonMoveE6) / 1e4).toFixed(2)}%</span>,
          ],
          ["Ladder points used", <span key="v" className="mono">{f.points}</span>],
          ["Gemini ticker", <span key="v" className="mono">{f.ticker || "--"}</span>],
          [
            "Expiry",
            <span key="v" className="mono">
              {new Date(Number(f.expiryTs) * 1000).toISOString().slice(0, 16).replace("T", " ")} UTC ({untilTime(Number(f.expiryTs) - now)})
            </span>,
          ],
          ["Confident", <span key="v">{f.confident ? "yes" : "no"}</span>],
          ["Max LTV (last valid post)", <span key="v" className="mono">{pctFromBps(f.maxLtvBps)}</span>],
          ["Max LTV (effective now)", <span key="v" className="mono">{pctFromBps(feedEffectiveLtvBps(f, ok.config.params, now))}</span>],
          ["Last post", <span key="v" className="mono">{relTime(now - Number(f.postedAt))}</span>],
          ["Last valid post", <span key="v" className="mono">{f.hasValid ? relTime(now - Number(f.lastValidAt)) : "never"}</span>],
        ]
      : [];

  return (
    <>
      <Link href="/" className="back">
        Back to board
      </Link>
      <h1>{symbol}</h1>
      <p className="lede">
        Brace reads Gemini&apos;s &quot;{symbol} above X&quot; price ladder, fits a probability curve to it onchain, and turns the implied
        volatility into a max loan-to-value. Higher volatility means a lower limit. If posts stop or lose confidence, the limit steps
        down every {ok ? Math.round(ok.config.params.staleSecs / 60) : 5} minutes toward a conservative floor.
      </p>

      <BoardNotice state={state} />

      {ok && !f && (
        <div className="notice" role="status">
          <strong>No data</strong>
          <span className="muted">The {symbol} feed account does not exist on devnet yet.</span>
        </div>
      )}

      {rows.length > 0 && (
        <dl className="facts">
          {rows.map(([k, v]) => (
            <div key={k}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
        </dl>
      )}

      <p className="small muted account-link">
        Feed account{" "}
        <a href={explorerAddress(pda)} target="_blank" rel="noopener noreferrer" className="mono">
          {pda.slice(0, 4)}...{pda.slice(-4)}
        </a>{" "}
        on Solana Explorer
      </p>
    </>
  );
}
