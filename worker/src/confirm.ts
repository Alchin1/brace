/** Lazy confirmation of fire-and-forget sendTransaction signatures. */

export const PENDING_EXPIRE_SECS = 90;
/**
 * Pending rows older than this are purged and never read again. A blockhash is only valid for
 * about 150 slots (roughly a minute), so a signature this old has landed or never will.
 */
export const PENDING_STALE_SECS = 600;

export type PendingSig = {
  sig: string;
  asset: string;
  submittedAt: number;
};

export type SignatureStatusLike = {
  err?: unknown;
  confirmationStatus?: string | null;
} | null;

export type ConfirmResult = {
  confirmed: PendingSig[];
  failed: (PendingSig & { error: string })[];
  pending: PendingSig[];
};

export function uniqueSigs(pending: PendingSig[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of pending) {
    if (!seen.has(p.sig)) {
      seen.add(p.sig);
      out.push(p.sig);
    }
  }
  return out;
}

export function formatSignatureErr(err: unknown): string {
  if (err == null) return "transaction failed";
  if (typeof err === "string") return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

export function applySignatureStatuses(
  pending: PendingSig[],
  statusBySig: Map<string, SignatureStatusLike>,
  nowSeconds: number,
): ConfirmResult {
  const confirmed: PendingSig[] = [];
  const failed: (PendingSig & { error: string })[] = [];
  const still: PendingSig[] = [];
  for (const p of pending) {
    const st = statusBySig.has(p.sig) ? statusBySig.get(p.sig) : null;
    if (st && st.err) {
      failed.push({ ...p, error: formatSignatureErr(st.err) });
      continue;
    }
    const status = st?.confirmationStatus ?? null;
    if (st && (status === "processed" || status === "confirmed" || status === "finalized")) {
      confirmed.push(p);
      continue;
    }
    if (st == null && nowSeconds - p.submittedAt >= PENDING_EXPIRE_SECS) {
      failed.push({ ...p, error: "signature expired or dropped" });
      continue;
    }
    still.push(p);
  }
  return { confirmed, failed, pending: still };
}
