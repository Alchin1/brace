"use client";

import { useId, useRef } from "react";
import { chartDomain, curvePoints, fmtPrice, niceTicks, pct1, probAbove } from "@/lib/chart";
import type { Symbol } from "@/lib/brace";
import { StatusCell } from "../Instruments";
import { BraceGauge } from "./BraceGauge";
import { useLadder, useWidth } from "./live";
import { figure, useFeedModel } from "./model";

function tick(v: number): string {
  if (v >= 10_000) return `$${Number((v / 1000).toFixed(1))}k`;
  if (v >= 100) return `$${Math.round(v)}`;
  if (v >= 1) return `$${Number(v.toFixed(2))}`;
  return `$${Number(v.toFixed(3))}`;
}

/**
 * The stage: one asset's live limit set as a monumental figure on recording
 * paper, with the fit the program stored onchain drawn through it and the live
 * Gemini quotes standing on the curve as rungs. Every mark comes from devnet or
 * /api/ladder; when either is missing the stage says so instead of drawing.
 */
export function Stage({ symbol, children, id }: { symbol: Symbol; children?: React.ReactNode; id?: string }) {
  const m = useFeedModel(symbol);
  const ladder = useLadder(m.feed?.ticker || null);
  const [ref, W] = useWidth<HTMLDivElement>(1200);
  const phone = W < 900;
  const H = phone ? 340 : 680;
  const top = phone ? 28 : 56;
  const bottom = phone ? 32 : 40;
  const ph = H - top - bottom;

  // The probe: what the onchain fit says about any strike under the pointer.
  // Scales live in a ref so pointer moves never re-render; only transforms and one text node change.
  const scale = useRef<{ min: number; max: number; median: number; sT: number } | null>(null);
  const probeRef = useRef<HTMLDivElement>(null);
  const dotRef = useRef<SVGGElement>(null);
  const readRef = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);
  const sectionRef = useRef<HTMLElement>(null);
  const clip = `st${useId().replace(/[^a-zA-Z0-9]/g, "")}`;
  const probe = (clientX: number, clientY: number, paper: HTMLElement) => {
    const sc = scale.current;
    const box = paper.getBoundingClientRect();
    if (!sc || !probeRef.current || !dotRef.current || !readRef.current) return;
    if (clientY < box.top || clientY > box.bottom) return hideProbe();
    const x = Math.max(0, Math.min(box.width, clientX - box.left));
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      const k = sc.min + (x / box.width) * (sc.max - sc.min);
      const p = probAbove(k, sc.median, sc.sT);
      const y = top + (1 - p) * ph;
      probeRef.current!.style.transform = `translate3d(${x}px,0,0)`;
      probeRef.current!.classList.toggle("is-left", x > box.width - 220);
      dotRef.current!.style.transform = `translate3d(${x}px,${y}px,0)`;
      readRef.current!.textContent = `${fmtPrice(k)}, ${(p * 100).toFixed(1)}% chance above`;
      sectionRef.current?.classList.add("is-probing");
    });
  };
  const hideProbe = () => {
    cancelAnimationFrame(frame.current);
    sectionRef.current?.classList.remove("is-probing");
  };

  let under: React.ReactNode = null;
  let over: React.ReactNode = null;
  let note: string | null = null;

  if (m.feed && m.params && m.spot !== null && m.median !== null) {
    const quotes = ladder.quotes;
    const dom = chartDomain({ median: m.median, sT: m.sT, spot: m.spot, band: m.band, strikes: quotes.map((q) => q.strike) });
    const xs = (v: number) => ((v - dom.min) / (dom.max - dom.min)) * W;
    const ys = (p: number) => top + (1 - p) * ph;
    const xt = niceTicks(dom.min, dom.max, phone ? 4 : 8).filter((v) => xs(v) > 24 && xs(v) < W - 24);
    const curve =
      m.median > 0 && m.sT > 0
        ? curvePoints(m.median, m.sT, dom.min, dom.max, 180)
            .map((p, i) => `${i ? "L" : "M"}${xs(p.x).toFixed(1)},${ys(p.y).toFixed(1)}`)
            .join("")
        : null;
    const penP = m.sT > 0 ? probAbove(m.spot, m.median, m.sT) : null;
    const sx = xs(m.spot);
    scale.current = m.median > 0 && m.sT > 0 ? { min: dom.min, max: dom.max, median: m.median, sT: m.sT } : null;
    under = (
      <>
        {(phone ? [0, 1] : [0, 0.5, 1]).map((p) => (
          <g key={p}>
            <line x1={0} x2={W} y1={ys(p)} y2={ys(p)} className="st-h" />
            {(!phone || p === 1) && (
              <text x={W - 4} y={ys(p) - 6} textAnchor="end" className="st-lbl">
                {p === 1 ? "100% chance above" : `${p * 100}%`}
              </text>
            )}
          </g>
        ))}
        {xt.map((v) => (
          <g key={v}>
            <line x1={xs(v)} x2={xs(v)} y1={top + ph} y2={top + ph + 6} className="st-t" />
            {!phone && (
              <text x={xs(v)} y={top + ph + 22} textAnchor="middle" className="st-lbl">
                {tick(v)}
              </text>
            )}
          </g>
        ))}
        {m.band && (
          <g className="st-band">
            <line x1={xs(m.band.lo)} x2={xs(m.band.lo)} y1={top} y2={top + ph} />
            <line x1={xs(m.band.hi)} x2={xs(m.band.hi)} y1={top} y2={top + ph} />
          </g>
        )}
        <line x1={sx} x2={sx} y1={top} y2={top + ph} className="st-spot" />
      </>
    );
    over = (
      <>
        <clipPath id={clip}>
          <rect className="st-reveal" x={0} y={0} width={W} height={H} />
        </clipPath>
        <g clipPath={`url(#${clip})`}>
          {curve && <path d={curve} pathLength={1} className="st-knock" />}
          {curve && <path d={curve} pathLength={1} className="st-curve" />}
        </g>
        {quotes.map((q, i) => {
          const x = xs(q.strike);
          return (
            <g key={q.strike} className="st-rung" style={{ "--i": i } as React.CSSProperties}>
              <line x1={x} x2={x} y1={ys(q.bid)} y2={ys(q.ask)} />
              <line x1={x - 4} x2={x + 4} y1={ys(q.bid)} y2={ys(q.bid)} />
              <line x1={x - 4} x2={x + 4} y1={ys(q.ask)} y2={ys(q.ask)} />
            </g>
          );
        })}
        <g ref={dotRef} className="st-probe-dot">
          <circle cx={0} cy={0} r={phone ? 5 : 6} />
        </g>
        {penP !== null && (
          <g className="st-pen">
            <circle cx={sx} cy={ys(penP)} r={phone ? 4 : 5} />
            {!phone && (
              <text x={sx + 10} y={ys(penP) - 10} className="st-pen-lbl">
                spot {fmtPrice(m.spot)}
              </text>
            )}
          </g>
        )}
      </>
    );
    note = !curve
      ? "No confident fit stored yet. The limit is held, not loosened."
      : ladder.state === "unavailable"
        ? "Gemini quotes are not loading right now. The curve is the last fit stored onchain."
        : ladder.state === "ok"
          ? `${quotes.length} Gemini quotes stand on the fit the program stored onchain.`
          : "Reading Gemini quotes.";
  }

  const stale = m.status === "stale";
  return (
    <section
      className={`stage${stale ? " is-stale" : ""}${m.limit === null ? " is-empty" : ""}`}
      aria-labelledby={id}
      ref={sectionRef}
      onPointerMove={(e) => {
        const paper = e.currentTarget.querySelector<HTMLElement>(".stage-paper");
        if (e.pointerType === "mouse" && paper) probe(e.clientX, e.clientY, paper);
      }}
      onPointerDown={(e) => {
        const paper = e.currentTarget.querySelector<HTMLElement>(".stage-paper");
        if (e.pointerType !== "mouse" && paper) probe(e.clientX, e.clientY, paper);
      }}
      onPointerLeave={(e) => {
        if (e.pointerType === "mouse") hideProbe();
      }}
    >
      {children && (
        <div className="wrap stage-copy-w">
          <div className="stage-copy">{children}</div>
        </div>
      )}
      <div className="stage-paper" ref={ref} aria-hidden>
        <svg className="st-under" width={W} height={H} viewBox={`0 0 ${W} ${H}`} focusable="false">
          {under}
        </svg>
        <svg className="st-over" width={W} height={H} viewBox={`0 0 ${W} ${H}`} focusable="false">
          {over}
        </svg>
        <div ref={probeRef} className="st-probe" style={{ top, height: ph }}>
          <span ref={readRef} className="st-probe-read" />
        </div>
        {scale.current && <span className="st-hint">{phone ? "Tap the paper to read any strike" : "Move across the paper to read any strike"}</span>}
      </div>
      <div className="wrap stage-fig-w">
        <div className="stage-figure">
          <p className="sf-k">
            <span>{symbol} borrow limit</span>
            <StatusCell status={m.down ? null : m.status} />
          </p>
          <p className="numeral" aria-label={m.limit === null ? `${symbol} limit not read yet` : `${symbol} limit ${pct1(m.limit)}`}>
            <span className="n-v" aria-hidden>
              {(m.limit === null ? "--.-" : figure(m.limit)).split("").map((c, i) => (
                <span key={`${i}${c}`} className="n-c" style={{ "--i": i } as React.CSSProperties}>
                  {c}
                </span>
              ))}
            </span>
            <span className="n-p">%</span>
          </p>
          <BraceGauge limitBps={m.limit} capBps={m.cap} liqBps={m.liq} tone={stale ? "stale" : undefined} />
          <p className="sf-meta">
            {m.down
              ? "Solana devnet is not answering. Trying again every 15 seconds."
              : m.loading
                ? "Reading the feed from Solana devnet"
                : m.feed
                  ? [
                      m.ageText ? `fit ${m.ageText}` : null,
                      `implied vol ${pct1(Number(m.feed.sigmaBps))}`,
                      m.limit !== null ? `buffer ${((m.liq - m.limit) / 100).toFixed(1)} pts to liquidation` : null,
                    ]
                      .filter(Boolean)
                      .join("  ·  ")
                  : `No ${symbol} feed on devnet yet`}
          </p>
          {note && <p className="sf-note">{note}</p>}
        </div>
      </div>
    </section>
  );
}
