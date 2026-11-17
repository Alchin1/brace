import type { FeedStatus, Symbol } from "@/lib/brace";

export const ASSET_NAMES: Record<Symbol, string> = {
  SOL: "Solana",
  BTC: "Bitcoin",
  ETH: "Ether",
  ZEC: "Zcash",
  XRP: "XRP",
};

export function StatusCell({ status, compact = false }: { status: FeedStatus | null; compact?: boolean }) {
  const s = status ?? "none";
  const text = status === null ? "reading" : s === "live" ? "live" : s === "stale" ? "stale, stepping down" : "no data";
  return (
    <span className={`status ${s}`}>
      <span className={`dot ${s}`} role="img" aria-label={compact ? text : undefined} aria-hidden={compact ? undefined : true} />
      <span className={compact ? "status-text" : undefined}>{text}</span>
    </span>
  );
}

/**
 * The signature gauge: a 0 to 100% track, filled to the current limit, with a
 * fixed tick at the governance cap and a muted tick at the liquidation threshold.
 */
export function Gauge({
  limitBps,
  capBps = 7500,
  liqBps = 8000,
  markBps = null,
  label,
}: {
  limitBps: number | null;
  capBps?: number;
  liqBps?: number;
  /** Optional marker, e.g. the user's LTV on /borrow. */
  markBps?: number | null;
  label?: string;
}) {
  const pct = (bps: number) => `${Math.min(100, Math.max(0, bps / 100))}%`;
  return (
    <svg
      className="gauge"
      width="100%"
      height="14"
      role="img"
      aria-label={label ?? (limitBps === null ? "No limit yet" : `Limit ${(limitBps / 100).toFixed(1)}% of a 100% scale, cap ${capBps / 100}%, liquidation ${liqBps / 100}%`)}
    >
      <rect className="track" x="0" y="4" width="100%" height="6" rx="1" />
      {limitBps !== null && <rect className="fill" x="0" y="4" width={pct(limitBps)} height="6" rx="1" />}
      <line className="cap" x1={pct(capBps)} x2={pct(capBps)} y1="0" y2="14" strokeWidth="1" shapeRendering="crispEdges" />
      <line className="liq" x1={pct(liqBps)} x2={pct(liqBps)} y1="2" y2="12" strokeWidth="1" shapeRendering="crispEdges" />
      {markBps !== null && (
        <line className="mark" x1={pct(markBps)} x2={pct(markBps)} y1="0" y2="14" strokeWidth="3" shapeRendering="crispEdges" />
      )}
    </svg>
  );
}
