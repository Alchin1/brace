"use client";

/*
 * Transaction progress for /borrow: Approve in wallet -> Sent -> Confirmed (or Rejected by the
 * program). Purely presentational: BorrowApp keeps owning the transaction logic and passes
 * the current phase in. Do not move any signing or sending code into this file.
 *
 * Motion: the active step's dot pulses (same ring as the live dot), finished steps fill,
 * the connector line fills between them. A rejection is a normal, expected outcome in the
 * demo (the over-limit borrow), so it is shown calmly with the program's reason, not as a
 * red alarm. aria-live="polite" announces each phase change once.
 */

export type TxPhase = "idle" | "approve" | "sent" | "confirmed" | "rejected" | "expired";

const STEPS: { key: "approve" | "sent" | "done"; label: string }[] = [
  { key: "approve", label: "Approve in wallet" },
  { key: "sent", label: "Sent to devnet" },
  { key: "done", label: "Result" },
];

function stepState(phase: TxPhase, key: "approve" | "sent" | "done"): "todo" | "active" | "done" | "fail" {
  const order = { approve: 0, sent: 1, done: 2 } as const;
  const at = phase === "approve" ? 0 : phase === "sent" ? 1 : phase === "idle" ? -1 : 2;
  if (key === "done" && at === 2) return phase === "confirmed" ? "done" : "fail";
  if (order[key] < at) return "done";
  if (order[key] === at) return "active";
  return "todo";
}

export function TxTimeline({ phase, resultText, explorerUrl }: { phase: TxPhase; resultText?: string; explorerUrl?: string }) {
  if (phase === "idle") return null;
  const announce =
    phase === "approve"
      ? "Waiting for your approval in the wallet"
      : phase === "sent"
        ? "Sent to devnet, waiting for confirmation"
        : phase === "confirmed"
          ? `Confirmed. ${resultText ?? ""}`
          : phase === "rejected"
            ? `Rejected by the program. ${resultText ?? ""}`
            : "The transaction expired before it landed. Try again and approve a little faster.";
  return (
    <div className="rv-tx">
      <ol className="rv-tx-steps">
        {STEPS.map((s) => {
          const st = stepState(phase, s.key);
          const label = s.key === "done" && st !== "todo" && st !== "active" ? (phase === "confirmed" ? "Confirmed" : phase === "rejected" ? "Rejected by the program" : "Expired") : s.label;
          return (
            <li key={s.key} className="rv-tx-step" data-state={st}>
              <span className="rv-tx-dot" aria-hidden />
              <span>{label}</span>
            </li>
          );
        })}
      </ol>
      <p className="rv-tx-msg" aria-live="polite">
        {announce}
        {explorerUrl && (phase === "confirmed" || phase === "rejected") && (
          <>
            {" "}
            <a className="rv-tx-link" href={explorerUrl} target="_blank" rel="noopener noreferrer">
              View on Explorer
            </a>
          </>
        )}
      </p>
    </div>
  );
}
