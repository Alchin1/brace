"use client";

import Link from "next/link";
import { SYMBOLS, feedEffectiveLtvBps, feedStatus } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { useBoard } from "../BoardProvider";
import { ASSET_NAMES } from "../Instruments";

/** Five assets, live limit and status, each a 44px+ link. Used in the menu sheet and on the 404. */
export function MiniBoard({ onNavigate }: { onNavigate?: () => void }) {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const liq = ok?.config.params.liqThresholdBps ?? 8000;
  return (
    <ul className="miniboard">
      {SYMBOLS.map((s) => {
        const f = ok?.feeds[s] ?? null;
        const status = ok ? feedStatus(f, ok.config.params, now) : null;
        const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
        return (
          <li key={s}>
            <Link href={`/asset/${s}`} className="mb-row" onClick={onNavigate} aria-label={`${s}, ${ASSET_NAMES[s]}, limit ${limit === null ? "not read yet" : pct1(limit)}${status ? `, ${status}` : ""}`}>
              <span className={`dot ${status ?? "none"}`} aria-hidden />
              <strong aria-hidden>{s}</strong>
              <span className="mb-bar" aria-hidden>
                {limit !== null && <i style={{ width: `${limit / 100}%` }} />}
                <b style={{ left: `${liq / 100}%` }} />
              </span>
              <span className="mb-v" aria-hidden>
                {limit === null ? "--" : pct1(limit)}
              </span>
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
