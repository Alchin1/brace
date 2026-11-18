"use client";

import { useEffect, useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { PROGRAM_ID, REPO_URL, explorerAddress } from "@/lib/brace";
import { RELAYER_URL } from "@/lib/history";
import { fetchWithTimeout } from "@/lib/net";
import { CopyField } from "./CopyField";
import { useSeen } from "./hooks";

type Health = { ok: boolean; lastRun: string | null; ageSecs: number | null } | null;

/** Relayer /health, read once the card is on screen and again every minute. */
function useRelayerHealth(enabled: boolean): [Health, boolean] {
  const [h, setH] = useState<Health>(null);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = async () => {
      try {
        const res = await fetchWithTimeout(`${RELAYER_URL}/health`);
        const body = (await res.json()) as { ok?: boolean; lastRun?: string; feeds?: Record<string, { ageSecs?: number }> };
        const ages = Object.values(body.feeds ?? {})
          .map((f) => f.ageSecs)
          .filter((a): a is number => typeof a === "number");
        if (!alive) return;
        setH({ ok: !!body.ok, lastRun: body.lastRun ?? null, ageSecs: ages.length ? Math.max(...ages) : null });
        setFailed(false);
      } catch {
        if (alive) setFailed(true);
      }
    };
    load();
    const t = setInterval(load, 60_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [enabled]);
  return [h, failed];
}

const shortId = (s: string) => `${s.slice(0, 6)}…${s.slice(-6)}`;

/** The machine's identity: program id, Explorer, relayer status, source. */
export function ProofCard({ compact = false }: { compact?: boolean }) {
  const [ref, seen] = useSeen<HTMLDivElement>("200px 0px");
  const [health, failed] = useRelayerHealth(seen);
  const id = PROGRAM_ID.toBase58();
  const fresh = health && health.ok && health.ageSecs !== null && health.ageSecs <= 180;
  const relayerText = failed
    ? "Relayer not answering"
    : !health
      ? "Checking relayer"
      : fresh
        ? `Relayer posting, oldest feed ${health.ageSecs}s ago`
        : health.ageSecs !== null
          ? `Relayer slow, oldest feed ${health.ageSecs}s ago`
          : "Relayer status unknown";
  return (
    <div ref={ref} className={`proof card-lit${compact ? " is-compact" : ""}`}>
      <div className="proof-head">
        <ShieldCheck size={18} aria-hidden />
        <span>Onchain proof</span>
        <span className={`proof-status ${failed ? "bad" : fresh ? "ok" : "wait"}`}>
          <span className="dot-s" aria-hidden />
          {relayerText}
        </span>
      </div>
      <CopyField label="Program id" value={id} display={compact ? shortId(id) : id} />
      <div className="proof-links">
        <a className="proof-link" href={explorerAddress(id)} target="_blank" rel="noopener noreferrer">
          Program on Solana Explorer <ArrowUpRight size={14} aria-hidden />
        </a>
        <a className="proof-link" href={`${RELAYER_URL}/health`} target="_blank" rel="noopener noreferrer">
          Relayer health <ArrowUpRight size={14} aria-hidden />
        </a>
        {!compact && (
          <a className="proof-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            Source on GitHub <ArrowUpRight size={14} aria-hidden />
          </a>
        )}
      </div>
    </div>
  );
}
