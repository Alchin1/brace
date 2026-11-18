"use client";

import { ArrowUpRight, Check, Lock, Wallet } from "lucide-react";
import { pct1 } from "@/lib/chart";
import type { FeedStatus } from "@/lib/brace";
import { RetryButton } from "../BoardProvider";
import { StatusCell } from "../Instruments";
import { LimitRing, LtvMeter } from "../ui/Meters";
import { RollingNumber } from "../ui/RollingNumber";
import { TxRail, VerdictPanel } from "../ui/Verdict";

/**
 * Everything the borrow page draws. It holds no wallet or transaction logic:
 * BorrowApp computes every value and passes the real handlers in.
 */

export type Done = { id: number; label: string; ok: boolean; message: string; sig: string | null; at: number };
export type Active = { id: number; label: string; phase: "wallet" | "sending"; sig: string | null };

type Feed = {
  limit: number | null;
  status: FeedStatus | null;
  cap: number;
  liq: number;
  spotText: string;
  fresh: boolean;
  rpcDown: string | null;
};

export type DisconnectedProps = Feed & {
  connecting: boolean;
  onConnect: () => void;
  picking: boolean;
  detected: { name: string; icon: string | null }[];
  onChoose: (name: string) => void;
  noWallet: boolean;
  connectMsg: string | null;
};

type Field = { text: string; set: (v: string) => void; valid: boolean };

export type ConnectedProps = Feed & {
  address: string;
  onDisconnect: () => void;
  loading: boolean;
  hasPosition: boolean;
  hasCollateral: boolean;
  nextStep: "open" | "deposit" | "borrow";
  ltv: number | null;
  collateralText: string | null;
  valueText: string | null;
  debtText: string | null;
  walletSolText: string | null;
  walletUsdText: string | null;
  deposit: Field;
  borrow: Field & { sliderMax: number; sliderValue: number; onSlide: (cents: number) => void; onType: (v: string) => void };
  repay: Field & { disabled: boolean };
  withdraw: Field & { disabled: boolean };
  afterLtv: number | null;
  overLimit: boolean;
  maxBorrowText: string | null;
  busy: boolean;
  onOpen: () => void;
  onDeposit: () => void;
  onBorrow: () => void;
  onRepay: () => void;
  onWithdraw: () => void;
  active: Active | null;
  last: Done | null;
  recent: Done[];
  positionHref: string | null;
  positionShort: string | null;
  explorerTx: (sig: string) => string;
  /** Set only by the dev preview. */
  previewNote?: string;
};

function LiveStrip({ limit, status, spotText, rpcDown, cap, liq }: Feed) {
  if (rpcDown) {
    return (
      <div className="notice is-error reading-error" role="alert">
        <strong>The live SOL limit is not loading</strong>
        <span className="muted">{rpcDown} Borrowing needs devnet, so wait a moment and try again.</span>
        <div className="notice-actions">
          <RetryButton />
        </div>
      </div>
    );
  }
  return (
    <div className="livestrip" aria-label="SOL feed right now">
      <LimitRing limitBps={limit} capBps={cap} liqBps={liq} size={44} center={<span />} label="SOL live limit" />
      <div className="ls-main">
        <span className="ls-k">SOL live limit</span>
        <span className="ls-v">{limit === null ? "--" : <RollingNumber value={pct1(limit)} />}</span>
      </div>
      <div className="ls-meta">
        <span>spot {spotText}</span>
        <StatusCell status={status} />
      </div>
    </div>
  );
}

export function DisconnectedView(p: DisconnectedProps) {
  return (
    <div className="bw bw-intro">
      <div className="bw-main">
        <LiveStrip {...p} />
        <div className="bw-connect card-lit">
          <p className="lede">Borrow test USD against devnet SOL. The program checks every borrow against the live limit.</p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={p.onConnect} disabled={p.connecting}>
            <Wallet size={18} aria-hidden /> {p.connecting ? "Connecting…" : "Connect wallet"}
          </button>
          {p.picking && (
            <div className="wallet-pick" role="group" aria-label="Choose a wallet">
              {p.detected.map((w) => (
                <button key={w.name} type="button" className="btn btn-secondary" onClick={() => p.onChoose(w.name)}>
                  {w.icon && <img src={w.icon} alt="" width={20} height={20} />}
                  {w.name}
                </button>
              ))}
            </div>
          )}
          {p.noWallet && (
            <p className="tx-line warn" role="status">
              No Solana wallet found in this browser. On a phone, open this page inside Phantom. On a computer, install Phantom or Solflare.
            </p>
          )}
          {p.connectMsg && (
            <p className="tx-line warn" role="status">
              {p.connectMsg}
            </p>
          )}
        </div>

        <section className="before card-lit" aria-labelledby="before-h">
          <h2 id="before-h">Before you start</h2>
          <ol className="rail">
            <li className="is-current">
              <span className="rail-n">1</span>
              <div>
                <strong>Turn on devnet in Phantom</strong>
                <p>In Phantom, open Settings, then Developer settings. Turn Testnet mode on and choose Solana Devnet.</p>
              </div>
            </li>
            <li>
              <span className="rail-n">2</span>
              <div>
                <strong>Get free devnet SOL</strong>
                <p>
                  Get devnet SOL at{" "}
                  <a className="text-link u" href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer">
                    faucet.solana.com
                  </a>
                  . It is free and has no value.
                </p>
              </div>
            </li>
            <li>
              <span className="rail-n">3</span>
              <div>
                <strong>Open Brace inside Phantom</strong>
                <p>On a phone, open this page in Phantom&apos;s in-app browser.</p>
              </div>
            </li>
          </ol>
        </section>
      </div>

      <aside className="bw-side">
        <div className="bay cockpit">
          <div className="bay-bar">
            <span className="bay-title">
              <span className={`dot ${p.status ?? "none"}`} aria-hidden />
              SOL position meter
            </span>
          </div>
          <div className="cockpit-ring">
            <LimitRing
              limitBps={p.limit}
              capBps={p.cap}
              liqBps={p.liq}
              size={220}
              center={<span className="ring-v big">--</span>}
              sub="Your LTV"
            />
          </div>
          <p className="cockpit-note">Connect to see your position against the live limit of {p.limit === null ? "--" : pct1(p.limit)}.</p>
          <LtvMeter ltvBps={null} limitBps={p.limit} liqBps={p.liq} label={`Live limit ${p.limit === null ? "unknown" : pct1(p.limit)}, liquidation ${pct1(p.liq)}`} />
        </div>
      </aside>
    </div>
  );
}

function stepState(key: "open" | "deposit" | "borrow", p: ConnectedProps): "done" | "current" | "locked" | "open" {
  if (key === "open") return p.hasPosition ? "done" : "current";
  if (key === "deposit") return !p.hasPosition ? "locked" : p.hasCollateral ? "done" : "current";
  return !p.hasCollateral ? "locked" : "current";
}

function StepMark({ state, n }: { state: string; n: number }) {
  return (
    <span className={`rail-n is-${state}`} aria-hidden>
      {state === "done" ? <Check size={14} /> : state === "locked" ? <Lock size={12} /> : n}
    </span>
  );
}

export function ConnectedView(p: ConnectedProps) {
  const fmtAfter = p.afterLtv === null ? "--" : p.afterLtv > 10_000 ? ">100%" : pct1(p.afterLtv);
  const steps: ("open" | "deposit" | "borrow")[] = p.loading || p.hasPosition ? ["deposit", "borrow"] : ["open", "deposit", "borrow"];
  const label = (k: string) => (k === "open" ? "Open position" : k === "deposit" ? "Deposit SOL" : "Borrow test USD");

  return (
    <div className={`bw bw-cockpit${p.overLimit ? " is-over" : ""}`}>
      {p.previewNote && (
        <p className="preview-note" role="note">
          {p.previewNote}
        </p>
      )}
      <div className="wallet-bar">
        <span className="wb-addr">
          <span className="dot live" aria-hidden /> Connected <span className="mono">{p.address}</span>
        </span>
        <button type="button" className="link-btn" onClick={p.onDisconnect}>
          Disconnect
        </button>
      </div>

      <div className="bw-main">
        <LiveStrip {...p} />
        <section className="card-lit steps" aria-label="Borrow steps">
          {p.loading ? (
            <div role="status" aria-busy="true" className="skel-list">
              <span className="sr-only">Reading your position from devnet.</span>
              <span className="skel skel-row" />
              <span className="skel skel-row" />
            </div>
          ) : (
            <ol className="rail">
              {steps.map((k, i) => {
                const st = stepState(k, p);
                return (
                  <li key={k} className={`is-${st}${k === "borrow" && p.overLimit ? " is-over" : ""}`}>
                    <StepMark state={st} n={i + 1} />
                    <div className="step-body">
                      <h3>{label(k)}</h3>
                      {k === "open" && (
                        <>
                          <p className="step-note">Creates your Position account on devnet. One time, a small rent deposit in SOL.</p>
                          <div className="step-actions">
                            <button type="button" className="btn btn-primary" onClick={p.onOpen} disabled={p.busy}>
                              Open position
                            </button>
                          </div>
                        </>
                      )}
                      {k === "deposit" && (
                        <>
                          <p className="step-note">
                            Wallet balance <span className="mono">{p.walletSolText ?? "--"}</span>
                          </p>
                          <div className="step-actions">
                            <label className="field">
                              <span className="sr-only">SOL to deposit</span>
                              <input inputMode="decimal" autoComplete="off" value={p.deposit.text} onChange={(e) => p.deposit.set(e.target.value)} aria-invalid={!p.deposit.valid} />
                              <span className="unit">SOL</span>
                            </label>
                            <button
                              type="button"
                              className={`btn ${p.nextStep === "deposit" ? "btn-primary" : "btn-secondary"}`}
                              onClick={p.onDeposit}
                              disabled={p.busy || !p.hasPosition || !p.deposit.valid}
                            >
                              Deposit
                            </button>
                          </div>
                        </>
                      )}
                      {k === "borrow" && (
                        <>
                          <p className="step-note">
                            {p.maxBorrowText ? `Up to ${p.maxBorrowText} test USD fits under the live limit right now.` : "Deposit SOL first. Borrowing is checked against its value."}
                          </p>
                          <div className="borrow-row">
                            <input
                              type="range"
                              className={`range${p.overLimit ? " is-over" : ""}`}
                              min={0}
                              max={Math.max(1, p.borrow.sliderMax)}
                              step={1}
                              value={p.borrow.sliderValue}
                              disabled={!p.hasCollateral}
                              style={{ ["--fill" as string]: `${Math.min(100, (p.borrow.sliderValue / Math.max(1, p.borrow.sliderMax)) * 100)}%` }}
                              aria-label="Test USD to borrow"
                              onChange={(e) => p.borrow.onSlide(Number(e.target.value))}
                            />
                            <label className="field">
                              <span className="sr-only">Test USD to borrow</span>
                              <input
                                inputMode="decimal"
                                autoComplete="off"
                                value={p.borrow.text}
                                disabled={!p.hasCollateral}
                                onChange={(e) => p.borrow.onType(e.target.value)}
                                aria-invalid={p.borrow.text !== "" && !p.borrow.valid}
                              />
                              <span className="unit">USD</span>
                            </label>
                          </div>

                          <div className={`after${p.overLimit ? " is-over" : ""}`}>
                            <div className="after-head">
                              <span>LTV after borrow</span>
                              <strong>{fmtAfter}</strong>
                            </div>
                            <LtvMeter
                              ltvBps={p.ltv}
                              afterBps={p.afterLtv}
                              limitBps={p.limit}
                              liqBps={p.liq}
                              label={`LTV after borrow ${p.afterLtv === null ? "unknown" : pct1(p.afterLtv)}, live limit ${p.limit === null ? "unknown" : pct1(p.limit)}`}
                            />
                          </div>

                          {p.overLimit && p.limit !== null && (
                            <div className="overwarn" role="status">
                              <strong>Over the live limit of {pct1(p.limit)}.</strong> The program will reject this.
                            </div>
                          )}
                          {!p.fresh && p.hasCollateral && (
                            <p className="tx-line warn" role="status">
                              The SOL price is more than an hour old. The program will pause borrowing until it updates.
                            </p>
                          )}

                          <div className="step-actions">
                            {p.overLimit ? (
                              <button type="button" className="btn btn-danger" onClick={p.onBorrow} disabled={p.busy || !p.borrow.valid || !p.hasCollateral}>
                                Submit anyway
                              </button>
                            ) : (
                              <button
                                type="button"
                                className={`btn ${p.nextStep === "borrow" ? "btn-primary" : "btn-secondary"}`}
                                onClick={p.onBorrow}
                                disabled={p.busy || !p.borrow.valid || !p.hasCollateral}
                              >
                                Borrow
                              </button>
                            )}
                          </div>
                          {p.overLimit && (
                            <p className="step-note phantom-note">
                              Phantom will warn that this transaction may fail. Confirm it anyway to see the program reject it onchain.
                            </p>
                          )}
                        </>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          )}

          {p.active ? (
            <TxRail phase={p.active.phase} label={p.active.label} sig={p.active.sig} explorerHref={p.active.sig ? p.explorerTx(p.active.sig) : null} />
          ) : p.last ? (
            <VerdictPanel ok={p.last.ok} label={p.last.label} message={p.last.message} sig={p.last.sig} explorerHref={p.last.sig ? p.explorerTx(p.last.sig) : null} />
          ) : (
            <p className="sr-only" role="status" aria-live="polite" />
          )}

          {p.hasPosition && (
            <details className="quiet">
              <summary>Repay or withdraw</summary>
              <div className="quiet-row">
                <label className="field">
                  <span className="sr-only">Test USD to repay</span>
                  <input inputMode="decimal" autoComplete="off" value={p.repay.text} onChange={(e) => p.repay.set(e.target.value)} placeholder="0.00" />
                  <span className="unit">USD</span>
                </label>
                <button type="button" className="btn btn-secondary" onClick={p.onRepay} disabled={p.busy || !p.repay.valid || p.repay.disabled}>
                  Repay
                </button>
              </div>
              <div className="quiet-row">
                <label className="field">
                  <span className="sr-only">SOL to withdraw</span>
                  <input inputMode="decimal" autoComplete="off" value={p.withdraw.text} onChange={(e) => p.withdraw.set(e.target.value)} placeholder="0.000" />
                  <span className="unit">SOL</span>
                </label>
                <button type="button" className="btn btn-secondary" onClick={p.onWithdraw} disabled={p.busy || !p.withdraw.valid || p.withdraw.disabled}>
                  Withdraw
                </button>
              </div>
              <p className="step-note">
                Test USD in your wallet <span className="mono">{p.walletUsdText ?? "--"}</span>. Withdrawing with debt is checked against the live limit too.
              </p>
            </details>
          )}
        </section>
      </div>

      <aside className="bw-side">
        <section className="bay cockpit" aria-labelledby="pos-h">
          <div className="bay-bar">
            <span className="bay-title" id="pos-h">
              <span className={`dot ${p.status ?? "none"}`} aria-hidden />
              Your position
            </span>
            {p.positionHref && p.positionShort && (
              <a className="bay-link" href={p.positionHref} target="_blank" rel="noopener noreferrer">
                {p.positionShort} <ArrowUpRight size={13} aria-hidden />
              </a>
            )}
          </div>
          <div className="cockpit-ring">
            <LimitRing
              limitBps={p.limit}
              capBps={p.cap}
              liqBps={p.liq}
              markBps={p.overLimit ? p.afterLtv : p.ltv}
              size={220}
              tone={p.overLimit ? "over" : undefined}
              center={<span className={`ring-v big${p.overLimit ? " bad" : ""}`}>{p.overLimit ? fmtAfter : p.ltv === null ? "--" : pct1(p.ltv)}</span>}
              sub={p.overLimit ? "LTV if you submit" : "Your LTV"}
              label={`Your LTV ${p.ltv === null ? "unknown" : pct1(p.ltv)}, live limit ${p.limit === null ? "unknown" : pct1(p.limit)}`}
            />
          </div>
          <div className="readings">
            <div>
              <span>Collateral</span>
              <strong>{p.collateralText ?? "--"}</strong>
            </div>
            <div>
              <span>Value at feed spot</span>
              <strong>{p.valueText ?? "--"}</strong>
            </div>
            <div>
              <span>Debt</span>
              <strong>{p.debtText ?? "--"}</strong>
            </div>
            <div>
              <span>Headroom to limit</span>
              <strong>{p.ltv !== null && p.limit !== null ? `${((p.limit - p.ltv) / 100).toFixed(1)} pts` : "--"}</strong>
            </div>
            <div>
              <span>SOL spot</span>
              <strong>{p.spotText}</strong>
            </div>
            <div>
              <span>SOL feed</span>
              <StatusCell status={p.status} />
            </div>
          </div>
          {!p.loading && !p.hasPosition && <p className="cockpit-note">No position yet. Open one to start.</p>}
        </section>
      </aside>

      <section className="recent" aria-labelledby="recent-h">
        <h2 id="recent-h">Recent actions</h2>
        {p.recent.length === 0 ? (
          <p className="step-note">Nothing yet. Actions from this visit show here and are not saved.</p>
        ) : (
          <ul className="actions-list">
            {p.recent.map((d) => (
              <li key={d.id} className={`arow2 ${d.ok ? "is-ok" : "is-blocked"}`}>
                <span className="ar-icon" aria-hidden>
                  {d.ok ? <Check size={16} /> : <Lock size={14} />}
                </span>
                <div className="ar-body">
                  <span className="ar-label">{d.label}</span>
                  <span className="ar-detail">{d.message}</span>
                </div>
                {d.sig ? (
                  <a className="ar-link" href={p.explorerTx(d.sig)} target="_blank" rel="noopener noreferrer">
                    Explorer <ArrowUpRight size={14} aria-hidden />
                  </a>
                ) : (
                  <span className="ar-link muted">no tx</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
