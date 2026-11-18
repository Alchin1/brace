import { pct1 } from "@/lib/chart";

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/**
 * Ring gauge. The accent arc fills to the live limit; ticks mark the
 * governance cap and the liquidation threshold. An optional needle marks a
 * position LTV, and the arc past the limit turns into a hatched red zone when
 * the needle is over it.
 */
export function LimitRing({
  limitBps,
  capBps = 7500,
  liqBps = 8000,
  markBps = null,
  size = 168,
  label,
  center,
  sub,
  tone,
}: {
  limitBps: number | null;
  capBps?: number;
  liqBps?: number;
  markBps?: number | null;
  size?: number;
  label?: string;
  center?: React.ReactNode;
  sub?: React.ReactNode;
  tone?: "ok" | "over" | "stale";
}) {
  // 270 degree arc, open at the bottom.
  const r = 42;
  const C = 2 * Math.PI * r;
  const arc = C * 0.75;
  const at = (bps: number) => (clamp(bps / 100) / 100) * arc;
  const angle = (bps: number) => 135 + (clamp(bps / 100) / 100) * 270;
  const tick = (bps: number, len: number) => {
    const a = (angle(bps) * Math.PI) / 180;
    const r1 = r + 6;
    const r2 = r + 6 + len;
    return { x1: 50 + r1 * Math.cos(a), y1: 50 + r1 * Math.sin(a), x2: 50 + r2 * Math.cos(a), y2: 50 + r2 * Math.sin(a) };
  };
  const over = tone === "over" || (markBps !== null && limitBps !== null && markBps > limitBps);
  const capT = tick(capBps, 5);
  const liqT = tick(liqBps, 5);
  const markA = markBps !== null ? (angle(Math.min(markBps, 10000)) * Math.PI) / 180 : 0;
  const aria =
    label ??
    (limitBps === null
      ? "Live limit not read yet"
      : `Live limit ${pct1(limitBps)} on a 0 to 100% scale. Cap ${pct1(capBps)}, liquidation ${pct1(liqBps)}${markBps !== null ? `, position ${pct1(markBps)}` : ""}.`);
  return (
    <div
      className={`ring${over ? " is-over" : ""}${tone === "stale" ? " is-stale" : ""}`}
      style={{ width: size }}
      role="meter"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={limitBps === null ? undefined : Math.round(limitBps) / 100}
      aria-label={aria}
    >
      <svg viewBox="0 0 100 100" width={size} height={size} aria-hidden focusable="false">
        <circle className="ring-track" cx="50" cy="50" r={r} strokeDasharray={`${arc} ${C}`} transform="rotate(135 50 50)" />
        {limitBps !== null && (
          <circle
            className="ring-fill"
            cx="50"
            cy="50"
            r={r}
            strokeDasharray={`${at(limitBps)} ${C}`}
            transform="rotate(135 50 50)"
          />
        )}
        {over && markBps !== null && limitBps !== null && (
          <circle
            className="ring-over"
            cx="50"
            cy="50"
            r={r}
            strokeDasharray={`0 ${at(limitBps)} ${Math.max(0, at(Math.min(markBps, 10000)) - at(limitBps))} ${C}`}
            transform="rotate(135 50 50)"
          />
        )}
        <line className="ring-cap" {...capT} />
        <line className="ring-liq" {...liqT} />
        {markBps !== null && (
          <line
            className="ring-needle"
            x1={50 + (r - 9) * Math.cos(markA)}
            y1={50 + (r - 9) * Math.sin(markA)}
            x2={50 + (r + 4) * Math.cos(markA)}
            y2={50 + (r + 4) * Math.sin(markA)}
          />
        )}
      </svg>
      <div className="ring-center">
        {center ?? <span className="ring-v">{limitBps === null ? "--" : pct1(limitBps)}</span>}
        {sub && <span className="ring-sub">{sub}</span>}
      </div>
    </div>
  );
}

/** Compact block meter, 20 blocks for 0 to 100%, with the limit filled and the cap marked. */
export function BlockMeter({ valueBps, capBps = 7500, label }: { valueBps: number | null; capBps?: number | null; label: string }) {
  const n = 20;
  const filled = valueBps === null ? 0 : Math.round((clamp(valueBps / 100) / 100) * n);
  const capAt = capBps == null ? -1 : Math.round((clamp(capBps / 100) / 100) * n);
  return (
    <span className="blocks" role="img" aria-label={label}>
      {Array.from({ length: n }, (_, i) => (
        <i key={i} className={`${i < filled ? "on" : ""}${i === capAt - 1 ? " cap" : ""}`} />
      ))}
    </span>
  );
}

/**
 * Horizontal LTV meter for a position: 0 to 100%, the live limit line, the
 * liquidation line, a hatched zone past the limit, the current LTV and an
 * optional after-borrow preview.
 */
export function LtvMeter({
  ltvBps,
  afterBps = null,
  limitBps,
  liqBps = 8000,
  label,
}: {
  ltvBps: number | null;
  afterBps?: number | null;
  limitBps: number | null;
  liqBps?: number;
  label: string;
}) {
  const p = (bps: number) => `${clamp(bps / 100)}%`;
  const over = afterBps !== null && limitBps !== null && afterBps > limitBps;
  return (
    <div className={`ltvm${over ? " is-over" : ""}`} role="img" aria-label={label}>
      <div className="ltvm-track">
        {limitBps !== null && <span className="ltvm-zone" style={{ left: p(limitBps) }} />}
        {ltvBps !== null && <span className="ltvm-now" style={{ width: p(ltvBps) }} />}
        {afterBps !== null && (
          <span
            className="ltvm-after"
            style={{ left: p(Math.min(ltvBps ?? 0, afterBps)), width: `${Math.abs(clamp(afterBps / 100) - clamp((ltvBps ?? 0) / 100))}%` }}
          />
        )}
        {limitBps !== null && <span className="ltvm-limit" style={{ left: p(limitBps) }} />}
        <span className="ltvm-liq" style={{ left: p(liqBps) }} />
        {afterBps !== null && <span className="ltvm-needle" style={{ left: p(Math.min(afterBps, 10000)) }} />}
      </div>
      <div className="ltvm-scale" aria-hidden>
        <span style={{ left: 0 }}>0%</span>
        {limitBps !== null && (
          <span className="lim" style={{ left: p(limitBps) }}>
            limit {pct1(limitBps)}
          </span>
        )}
        <span className="liq" style={{ left: p(liqBps) }}>
          liq {pct1(liqBps)}
        </span>
      </div>
    </div>
  );
}
