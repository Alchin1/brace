import { pct1 } from "@/lib/chart";
import { BraceGauge } from "../v2/BraceGauge";
import { scaleLabelsCollide } from "./display";

const clamp = (v: number) => Math.min(100, Math.max(0, v));

/**
 * The position meter. Same props as the old ring, drawn the Brace way: the
 * figure on top, then the brace gauge with the live limit, cap, liquidation and
 * an optional position mark. Over the limit, the overshoot is hatched red.
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
  const over = tone === "over" || (markBps !== null && limitBps !== null && markBps > limitBps);
  const aria =
    label ??
    (limitBps === null
      ? "Live limit not read yet"
      : `Live limit ${pct1(limitBps)} on a 0 to 100% scale. Cap ${pct1(capBps)}, liquidation ${pct1(liqBps)}${markBps !== null ? `, position ${pct1(markBps)}` : ""}.`);
  if (size < 80) {
    return (
      <span className={`pm-mini${over ? " is-over" : ""}`} role="img" aria-label={aria}>
        {limitBps !== null && <i style={{ width: `${clamp(limitBps / 100)}%` }} />}
        <b style={{ left: `${clamp(liqBps / 100)}%` }} />
      </span>
    );
  }
  return (
    <div className={`pm${over ? " is-over" : ""}${tone === "stale" ? " is-stale" : ""}`} role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={limitBps === null ? undefined : Math.round(limitBps) / 100} aria-label={aria}>
      <div className="pm-top" aria-hidden>
        {center ?? <span className="ring-v">{limitBps === null ? "--" : pct1(limitBps)}</span>}
        {sub && <span className="ring-sub">{sub}</span>}
      </div>
      <BraceGauge limitBps={limitBps} capBps={capBps} liqBps={liqBps} markBps={markBps} tone={over ? "over" : tone === "stale" ? "stale" : undefined} decorative className="pm-gauge" />
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
  // Limit close to liquidation: the limit label takes its own row so the two never collide.
  const stacked = scaleLabelsCollide(limitBps, liqBps);
  return (
    <div className={`ltvm${over ? " is-over" : ""}${stacked ? " is-stacked" : ""}`} role="img" aria-label={label}>
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
