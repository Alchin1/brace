"use client";

import { useEffect, useRef, useState } from "react";
import { feedEffectiveLtvBps, feedStatus, relTime } from "@/lib/brace";
import { horizonLabel, limitPath, pct1 } from "@/lib/chart";
import { useBoard } from "../BoardProvider";

/** Copy is taken from the About page. Each step carries a small real reading. */
const STEPS = [
  {
    t: "Read the market",
    b: "A relayer reads Gemini's live price ladders every minute and posts the raw quotes to Solana devnet. It posts quotes, never conclusions.",
  },
  {
    t: "Fit the curve onchain",
    b: "The Brace program filters the quotes, converts each midpoint to a z-score with a fixed lookup table and fits the curve by least squares. Anyone can check the math.",
  },
  {
    t: "Turn volatility into a limit",
    b: "Max LTV is the lower of the governance max and a volatility-adjusted limit. A bigger expected move means a lower limit.",
  },
  {
    t: "Fail safe, never loose",
    b: "Stale or low-confidence data never loosens anything. Brace keeps the last valid limit and steps it down until fresh data arrives.",
  },
];

function QuotesViz({ points }: { points: number | null }) {
  const n = Math.max(0, Math.min(24, points ?? 0));
  return (
    <div className="hv hv-quotes" aria-hidden>
      <svg viewBox="0 0 200 64" width="100%" height="64">
        {Array.from({ length: 12 }, (_, i) => {
          const x = 12 + i * 16;
          const y = 8 + 48 / (1 + Math.exp((i - 5.5) * 0.9));
          const on = i < n;
          return (
            <g key={i} className={on ? "on" : ""}>
              <line x1={x} x2={x} y1={y - 5} y2={y + 5} />
              <circle cx={x} cy={y} r="2.6" />
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function FitViz() {
  const d = Array.from({ length: 41 }, (_, i) => {
    const x = 6 + i * 4.7;
    const y = 8 + 48 / (1 + Math.exp((i - 20) * 0.28));
    return `${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`;
  }).join("");
  return (
    <div className="hv hv-fit" aria-hidden>
      <svg viewBox="0 0 200 64" width="100%" height="64">
        <rect x="70" y="4" width="60" height="56" className="band" />
        <path d={d} className="curve" />
      </svg>
    </div>
  );
}

export function HowItWorks() {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok?.feeds.SOL ?? null;
  const p = ok?.config.params ?? null;
  const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
  const status = ok ? feedStatus(f, ok.config.params, now) : null;
  const lp =
    f && p && f.hasValid && limit !== null
      ? limitPath({
          horizonMoveE6: Number(f.horizonMoveE6),
          kX100: p.kX100,
          liqBps: p.liqThresholdBps,
          floorBps: p.absFloorLtvBps,
          capBps: p.govMaxLtvBps,
          horizonSecs: p.horizonSecs,
          maxLtvBps: f.maxLtvBps,
          effectiveBps: limit,
        })
      : null;
  const movePct = f && p ? ((p.kX100 * Number(f.horizonMoveE6)) / 1e8) * 100 : null;

  const [active, setActive] = useState(0);
  const refs = useRef<(HTMLLIElement | null)[]>([]);
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) setActive(Number((e.target as HTMLElement).dataset.i));
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    refs.current.forEach((el) => el && io.observe(el));
    return () => io.disconnect();
  }, []);

  const readings = [
    <>
      <QuotesViz points={f ? f.points : null} />
      <p className="hv-read">
        <span>Quotes in the last SOL fit</span>
        <strong>{f ? f.points : "--"}</strong>
      </p>
    </>,
    <>
      <FitViz />
      <p className="hv-read">
        <span>SOL implied vol, fitted onchain</span>
        <strong>{f ? pct1(Number(f.sigmaBps)) : "--"}</strong>
      </p>
    </>,
    <>
      <div className="hv hv-formula" aria-hidden={false}>
        <div>
          <span>{p ? `${p.kX100 / 100}σ ${horizonLabel(p.horizonSecs)} move` : "Expected move"}</span>
          <strong>{movePct === null ? "--" : `±${movePct.toFixed(1)}%`}</strong>
        </div>
        <span className="hv-arrow" aria-hidden>
          →
        </span>
        <div>
          <span>SOL limit</span>
          <strong className="acc">{limit === null ? "--" : pct1(limit)}</strong>
        </div>
      </div>
      <p className="hv-read">
        <span>Liquidation stays fixed at</span>
        <strong>{p ? pct1(p.liqThresholdBps) : "--"}</strong>
      </p>
    </>,
    <>
      <div className={`hv hv-clock ${status ?? "none"}`} aria-hidden>
        <span className="clk" />
        <span className="clk-t">{status === "live" ? "Fresh data" : status === "stale" ? "Stepping down" : "Reading"}</span>
      </div>
      <p className="hv-read">
        <span>Last confident SOL update</span>
        <strong>{f && f.hasValid ? relTime(now - Number(f.lastValidAt)) : "--"}</strong>
      </p>
    </>,
  ];

  return (
    <div className="how">
      <div className="how-rail" aria-hidden>
        <div className="how-rail-in">
          {STEPS.map((s, i) => (
            <div key={s.t} className={`how-tab${i === active ? " is-on" : ""}${i < active ? " is-past" : ""}`}>
              <span className="how-n">0{i + 1}</span>
              <span>{s.t}</span>
            </div>
          ))}
          <span className="how-progress" style={{ transform: `scaleY(${(active + 1) / STEPS.length})` }} />
        </div>
      </div>
      <ol className="how-steps">
        {STEPS.map((s, i) => (
          <li
            key={s.t}
            data-i={i}
            ref={(el) => {
              refs.current[i] = el;
            }}
            className={`how-step card-lit${i === active ? " is-on" : ""}`}
            data-reveal
          >
            <div className="how-copy">
              <span className="how-n">0{i + 1}</span>
              <h3>{s.t}</h3>
              <p>{s.b}</p>
            </div>
            <div className="how-viz">{readings[i]}</div>
          </li>
        ))}
      </ol>
      {lp && <p className="sr-only">Current SOL limit math: {lp.text}</p>}
    </div>
  );
}
