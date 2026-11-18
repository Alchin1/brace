"use client";

import Link from "next/link";
import { useState } from "react";
import { Pause, Play } from "lucide-react";
import { SYMBOLS, feedEffectiveLtvBps, feedStatus } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { useBoard } from "../BoardProvider";
import { AssetGlyph } from "./AssetGlyph";
import { ASSET_NAMES } from "../Instruments";

/**
 * The five live feeds on one rail. The loop is CSS, pauses on hover and focus,
 * has a Pause button (WCAG 2.2.2), and becomes a plain scroll row under
 * reduced motion. The duplicate copy for the loop is hidden from assistive tech.
 */
export function LiveTape() {
  const { state, now } = useBoard();
  const [paused, setPaused] = useState(false);
  const ok = state?.kind === "ok" ? state : null;

  const items = SYMBOLS.map((s) => {
    const f = ok?.feeds[s] ?? null;
    const status = ok ? feedStatus(f, ok.config.params, now) : null;
    const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
    const vol = f ? pct1(Number(f.sigmaBps)) : "--";
    return { s, status, limit, vol };
  });

  const row = (hidden: boolean) => (
    <ul className="tape-row" aria-hidden={hidden || undefined}>
      {items.map((it) => (
        <li key={it.s}>
          <Link href={`/asset/${it.s}`} className="tape-item" tabIndex={hidden ? -1 : undefined}>
            <AssetGlyph sym={it.s} size={24} />
            <span className="tape-sym">{it.s}</span>
            <span className="tape-name">{ASSET_NAMES[it.s]}</span>
            <span className="tape-k">limit</span>
            <span className="tape-v">{it.limit === null ? "--" : pct1(it.limit)}</span>
            <span className="tape-k">vol</span>
            <span className="tape-v2">{it.vol}</span>
            <span className={`dot ${it.status ?? "none"}`} aria-hidden />
          </Link>
        </li>
      ))}
    </ul>
  );

  return (
    <div className={`tape${paused ? " is-paused" : ""}`} aria-label="Live limits for every asset">
      <div className="tape-label">
        <span className="live-dot" aria-hidden />
        <span className="tape-label-t">Live from devnet</span>
      </div>
      <div className="tape-viewport">
        <div className="tape-track">
          {row(false)}
          {row(true)}
        </div>
      </div>
      <button type="button" className="tape-pause" onClick={() => setPaused((p) => !p)} aria-pressed={paused} aria-label={paused ? "Play the live tape" : "Pause the live tape"}>
        {paused ? <Play size={14} aria-hidden /> : <Pause size={14} aria-hidden />}
      </button>
    </div>
  );
}
