"use client";

import { useEffect, useState } from "react";
import { feedEffectiveLtvBps, feedStatus, fromE6 } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { RELAYER_URL, explorerTx } from "@/lib/history";
import { useBoard } from "@/components/BoardProvider";
import { ConnectedView } from "@/components/borrow/BorrowView";
import { PageHead } from "@/components/ui/PageHead";

/** Sample position for the dev preview only. The SOL limit and spot are the live devnet reads. */
export function PreviewClient({ state }: { state: string }) {
  if (process.env.NODE_ENV === "production") return null;
  return <Inner state={state} />;
}

function Inner({ state }: { state: string }) {
  const { state: board, now } = useBoard();
  const ok = board?.kind === "ok" ? board : null;
  const f = ok?.feeds.SOL ?? null;
  const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : 7000;
  const status = ok ? feedStatus(f, ok.config.params, now) : null;
  const cap = ok?.config.params.govMaxLtvBps ?? 7500;
  const liq = ok?.config.params.liqThresholdBps ?? 8000;
  const spot = f ? Number(f.spotE6) / 1e6 : 0;

  // A real blocked borrow from the relayer, so the Explorer link opens a real reject.
  const [blockedSig, setBlockedSig] = useState<string | null>(null);
  useEffect(() => {
    const since = Math.floor(Date.now() / 1000) - 7 * 86400;
    fetch(`${RELAYER_URL}/actions?since=${since}`)
      .then((r) => r.json())
      .then((rows: { kind: string; tx: string }[]) => {
        const b = rows.filter((r) => r.kind === "blocked").pop();
        if (b) setBlockedSig(b.tx);
      })
      .catch(() => undefined);
  }, []);

  const collateralSol = 0.5;
  const value = collateralSol * spot;
  // "rejected-near": a reject 1 bps over the limit, like the real 7049 vs 7048 devnet reject.
  const near = state === "rejected-near";
  const rejected = state === "rejected" || near;
  const over = state === "over" || rejected;
  const ltv = 0;
  const after = near ? limit + 1 : over ? limit + 260 : Math.max(0, limit - 1500);
  const borrowUsd = value > 0 ? (value * after) / 10000 : 0;
  const message =
    rejected
      ? `Rejected onchain: this borrow would put you at ${pct1(after)} against a live limit of ${pct1(limit)}.`
      : `Borrowed ${borrowUsd.toFixed(2)} test USD. LTV now ${pct1(after)}.`;
  const last =
    rejected || state === "success"
      ? { id: 1, label: `Borrow ${borrowUsd.toFixed(2)} test USD`, ok: state === "success", message, sig: blockedSig, at: Date.now(), blocked: rejected ? { ltvBps: after, limitBps: limit } : null }
      : null;
  const active = state === "sending" ? { id: 2, label: `Borrow ${borrowUsd.toFixed(2)} test USD`, phase: "sending" as const, sig: blockedSig } : null;
  const noop = () => undefined;

  return (
    <>
      <PageHead kicker="Borrow on devnet" title="Try a borrow" />
      <ConnectedView
        previewNote={`Dev preview, state "${state}". Sample position of ${collateralSol} SOL; the SOL limit and spot are live devnet reads. Not in production.`}
        limit={limit}
        status={status}
        cap={cap}
        liq={liq}
        spotText={f ? `$${fromE6(f.spotE6)}` : "--"}
        fresh
        rpcDown={null}
        address="Prev…iew1"
        onDisconnect={noop}
        loading={false}
        hasPosition
        hasCollateral
        nextStep="borrow"
        ltv={state === "success" ? after : ltv}
        collateralText={`${collateralSol.toFixed(3)} SOL`}
        valueText={spot ? `$${value.toFixed(2)}` : "--"}
        debtText={state === "success" ? `${borrowUsd.toFixed(2)} test USD` : "0.00 test USD"}
        walletSolText="1.000 SOL"
        walletUsdText={state === "success" ? borrowUsd.toFixed(2) : "0.00"}
        deposit={{ text: "0.5", set: noop, valid: true }}
        borrow={{
          text: borrowUsd.toFixed(2),
          set: noop,
          valid: true,
          sliderMax: Math.round(((value * 9000) / 10000) * 100),
          sliderValue: Math.round(borrowUsd * 100),
          onSlide: noop,
          onType: noop,
        }}
        repay={{ text: "", set: noop, valid: false, disabled: true }}
        withdraw={{ text: "", set: noop, valid: false, disabled: false }}
        afterLtv={state === "success" ? null : after}
        overLimit={over}
        maxBorrowText={value ? ((value * limit) / 10000).toFixed(2) : null}
        busy={state === "sending"}
        onOpen={noop}
        onDeposit={noop}
        onBorrow={noop}
        onRepay={noop}
        onWithdraw={noop}
        active={active}
        last={last}
        recent={last ? [last] : []}
        positionHref={null}
        positionShort={null}
        explorerTx={explorerTx}
      />
    </>
  );
}
