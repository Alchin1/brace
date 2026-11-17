"use client";

import Link from "next/link";
import { SYMBOLS, feedEffectiveLtvBps, feedStatus, pctFromBps, relTime, type FeedStatus } from "@/lib/brace";
import { BoardNotice, useBoard } from "./BoardProvider";

export function StatusCell({ status }: { status: FeedStatus }) {
  const text = status === "live" ? "live" : status === "stale" ? "stale, stepping down" : "no data";
  const label = status === "live" ? "Live" : status === "stale" ? "Stale, limit stepping down" : "No data";
  return (
    <span className="status">
      <span className={`dot ${status}`} role="img" aria-label={label} />
      {text}
    </span>
  );
}

export function Board() {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const sol = ok?.feeds.SOL ?? null;

  return (
    <>
      <BoardNotice state={state} />

      <div className="tiles">
        <div className="tile">
          <div className="tile-label">SOL max borrow</div>
          <div className="tile-value mono">{ok && sol ? pctFromBps(feedEffectiveLtvBps(sol, ok.config.params, now), 1) : "--"}</div>
          <div className="tile-note">Effective max loan-to-value</div>
        </div>
        <div className="tile">
          <div className="tile-label">Last onchain update</div>
          <div className="tile-value mono">{ok && sol ? relTime(now - Number(sol.postedAt)) : "--"}</div>
          <div className="tile-note">SOL feed, posted_at</div>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <caption>Per-asset limits, read from devnet every 15 seconds</caption>
          <thead>
            <tr>
              <th scope="col">Asset</th>
              <th scope="col" className="num">Implied vol</th>
              <th scope="col" className="num">Max LTV</th>
              <th scope="col">Status</th>
            </tr>
          </thead>
          <tbody>
            {SYMBOLS.map((s) => {
              const f = ok ? ok.feeds[s] : null;
              const status = ok ? feedStatus(f, ok.config.params, now) : null;
              return (
                <tr key={s}>
                  <th scope="row" className="row-head">
                    <Link href={`/asset/${s}`}>{s}</Link>
                  </th>
                  <td className="num mono">{f ? pctFromBps(f.sigmaBps) : "--"}</td>
                  <td className="num mono">{ok && f ? pctFromBps(feedEffectiveLtvBps(f, ok.config.params, now)) : "--"}</td>
                  <td>{status ? <StatusCell status={status} /> : <span className="muted">--</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
