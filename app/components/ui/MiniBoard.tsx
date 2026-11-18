"use client";

import Link from "next/link";
import { SYMBOLS, feedEffectiveLtvBps, feedStatus } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { useBoard } from "../BoardProvider";
import { ASSET_NAMES } from "../Instruments";
import { AssetGlyph } from "./AssetGlyph";
import { BlockMeter } from "./Meters";

/** Five assets, live limit and status, each a 44px+ link. Used in the menu sheet and 404. */
export function MiniBoard({ onNavigate }: { onNavigate?: () => void }) {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const cap = ok?.config.params.govMaxLtvBps ?? 7500;
  return (
    <ul className="miniboard">
      {SYMBOLS.map((s) => {
        const f = ok?.feeds[s] ?? null;
        const status = ok ? feedStatus(f, ok.config.params, now) : null;
        const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
        return (
          <li key={s}>
            <Link href={`/asset/${s}`} className="mb-row" onClick={onNavigate}>
              <AssetGlyph sym={s} size={28} />
              <span className="mb-name">
                <strong>{s}</strong>
                <span>{ASSET_NAMES[s]}</span>
              </span>
              <BlockMeter valueBps={limit} capBps={cap} label={`${s} limit ${limit === null ? "not read yet" : pct1(limit)}`} />
              <span className="mb-v">{limit === null ? "--" : pct1(limit)}</span>
              <span className={`dot ${status ?? "none"}`} aria-hidden />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
