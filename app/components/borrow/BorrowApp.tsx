"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { WalletReadyState, type WalletError, type WalletName } from "@solana/wallet-adapter-base";
import { Transaction, type PublicKey, type TransactionInstruction } from "@solana/web3.js";
import { explorerAddress, feedEffectiveLtvBps, feedStatus, fromE6 } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import {
  USD_DECIMALS,
  collateralValueE6,
  decodePosition,
  failureMessage,
  formatUnits,
  isWalletRejection,
  ltvBps,
  maxBorrow,
  parseUnits,
  priceFresh,
  type Position,
} from "@/lib/position";
import { borrowIxs, depositIx, openPositionIx, positionPda, repayIx, usdAta, withdrawIx } from "@/lib/tx";
import { RetryButton, useBoard } from "../BoardProvider";
import { Gauge, StatusCell } from "../Instruments";

const SOL_DECIMALS = 9;
const POLL_MS = 15_000;
/** The slider reaches past the cap so an over-limit borrow is one drag away. */
const SLIDER_MAX_LTV_BPS = 9000;

export function explorerTx(sig: string): string {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

const short = (s: string) => `${s.slice(0, 4)}…${s.slice(-4)}`;
const sol = (lamports: bigint, places = 3) => formatUnits(lamports, SOL_DECIMALS, places);
const usd = (base: bigint) => formatUnits(base, USD_DECIMALS, 2);

type Account = { position: Position | null; lamports: bigint; usdBase: bigint };
type Phase = "wallet" | "sending";
type Done = { id: number; label: string; ok: boolean; message: string; sig: string | null; at: number };
type Active = { id: number; label: string; phase: Phase; sig: string | null };

function useAccount(owner: PublicKey | null) {
  const { connection } = useConnection();
  const [acct, setAcct] = useState<Account | null>(null);
  const ownerKey = owner?.toBase58() ?? null;

  const load = useCallback(async () => {
    if (!owner) return;
    try {
      const [infos, lamports] = await Promise.all([
        connection.getMultipleAccountsInfo([positionPda(owner), usdAta(owner)]),
        connection.getBalance(owner),
      ]);
      const [posInfo, ataInfo] = infos;
      let position: Position | null = null;
      if (posInfo) {
        try {
          position = decodePosition(posInfo.data);
        } catch {
          position = null;
        }
      }
      // SPL token account: amount is the u64 at offset 64.
      const usdBase = ataInfo && ataInfo.data.length >= 72 ? new DataView(ataInfo.data.buffer, ataInfo.data.byteOffset).getBigUint64(64, true) : 0n;
      setAcct({ position, lamports: BigInt(lamports), usdBase });
    } catch {
      // Keep the last read; the next poll tries again.
    }
  }, [connection, owner]);

  useEffect(() => {
    setAcct(null);
    if (!ownerKey) return;
    load();
    const t = setInterval(load, POLL_MS);
    return () => clearInterval(t);
  }, [ownerKey, load]);

  return { acct, reload: load };
}

export function BorrowApp({ walletError, clearWalletError }: { walletError: WalletError | null; clearWalletError: () => void }) {
  const { publicKey, connected, connecting, wallets, wallet, select, connect, disconnect, sendTransaction } = useWallet();
  const { connection } = useConnection();
  const { state, now } = useBoard();
  const { acct, reload } = useAccount(connected ? publicKey : null);

  // Feed and limit, from the shared board read.
  const ok = state?.kind === "ok" ? state : null;
  const feed = ok?.feeds.SOL ?? null;
  const params = ok?.config.params ?? null;
  const limit = ok && feed && now ? feedEffectiveLtvBps(feed, ok.config.params, now) : null;
  const status = ok && now ? feedStatus(feed, ok.config.params, now) : null;
  const fresh = feed && now ? priceFresh(feed.hasValid, feed.spotE6, feed.lastValidAt, now) : true;
  const cap = params?.govMaxLtvBps ?? 7500;
  const liq = params?.liqThresholdBps ?? 8000;
  const spot = feed?.spotE6 ?? 0n;

  // Position numbers.
  const pos = acct?.position ?? null;
  const collateral = pos?.collateralLamports ?? 0n;
  const debt = pos?.debt ?? 0n;
  const value = collateralValueE6(collateral, spot);
  const ltv = pos && spot > 0n ? ltvBps(debt, value) : null;

  // Inputs.
  const [depositText, setDepositText] = useState("0.5");
  const [borrowText, setBorrowText] = useState("");
  const touched = useRef(false);
  const [repayText, setRepayText] = useState("");
  const [withdrawText, setWithdrawText] = useState("");

  const sliderMaxCents = value > 0n ? Number(maxBorrow(debt, value, SLIDER_MAX_LTV_BPS) / 10_000n) : 0;
  const borrowBase = parseUnits(borrowText, USD_DECIMALS);
  const afterLtv = borrowBase !== null && value > 0n ? ltvBps(debt + borrowBase, value) : null;
  const overLimit = afterLtv !== null && limit !== null && afterLtv > limit;

  // Default borrow: half of what the live limit allows, in whole test USD.
  useEffect(() => {
    if (touched.current || limit === null || value === 0n) return;
    const half = maxBorrow(debt, value, limit) / 2n;
    const whole = (half / 1_000_000n) * 1_000_000n;
    if (whole > 0n) setBorrowText(formatUnits(whole, USD_DECIMALS, 2).replace(/,/g, ""));
  }, [limit, value, debt]);

  // Repay and withdraw defaults follow the position.
  const debtKey = debt.toString();
  const collKey = collateral.toString();
  useEffect(() => {
    setRepayText(debt > 0n ? formatUnits(debt, USD_DECIMALS, 6).replace(/,/g, "").replace(/\.?0+$/, "") : "");
    setWithdrawText(debt === 0n && collateral > 0n ? formatUnits(collateral, SOL_DECIMALS, 9).replace(/,/g, "").replace(/\.?0+$/, "") : "");
  }, [debtKey, collKey]); // eslint-disable-line react-hooks/exhaustive-deps

  // Transactions.
  const [active, setActive] = useState<Active | null>(null);
  const [last, setLast] = useState<Done | null>(null);
  const [recent, setRecent] = useState<Done[]>([]);
  const nextId = useRef(1);

  /** Logs of a landed transaction, retried briefly while the RPC indexes it. */
  const fetchLogs = useCallback(
    async (sig: string): Promise<string[] | null> => {
      for (let i = 0; i < 6; i++) {
        try {
          const t = await connection.getTransaction(sig, { commitment: "confirmed", maxSupportedTransactionVersion: 0 });
          if (t?.meta) return t.meta.logMessages ?? null;
        } catch {
          // not indexed yet
        }
        await new Promise((r) => setTimeout(r, 1000));
      }
      return null;
    },
    [connection],
  );

  const run = useCallback(
    async (label: string, ixs: TransactionInstruction[], opts: { skipPreflight: boolean; success: string }) => {
      if (!publicKey || active) return;
      const id = nextId.current++;
      let sig: string | null = null;
      setActive({ id, label, phase: "wallet", sig: null });
      let done: Done;
      try {
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
        const tx = new Transaction({ feePayer: publicKey, blockhash, lastValidBlockHeight }).add(...ixs);
        sig = await sendTransaction(tx, connection, { skipPreflight: opts.skipPreflight, preflightCommitment: "confirmed", maxRetries: 5 });
        setActive({ id, label, phase: "sending", sig });
        const conf = await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
        if (conf.value.err) {
          const logs = await fetchLogs(sig);
          done = { id, label, ok: false, message: failureMessage(conf.value.err, logs), sig, at: Date.now() };
        } else {
          done = { id, label, ok: true, message: opts.success, sig, at: Date.now() };
        }
      } catch (e) {
        const logs = (e as { logs?: string[] }).logs ?? (sig ? await fetchLogs(sig) : null);
        done = { id, label, ok: false, message: failureMessage(e, logs), sig, at: Date.now() };
      }
      setActive(null);
      setLast(done);
      setRecent((r) => [done, ...r].slice(0, 12));
      reload();
    },
    [publicKey, active, connection, sendTransaction, reload, fetchLogs],
  );

  const busy = active !== null;

  // Actions.
  const doOpen = () => publicKey && run("Open position", [openPositionIx(publicKey)], { skipPreflight: false, success: "Position opened." });
  const depositLamports = parseUnits(depositText, SOL_DECIMALS);
  const doDeposit = () =>
    publicKey &&
    depositLamports &&
    run(`Deposit ${sol(depositLamports)} SOL`, [depositIx(publicKey, depositLamports)], {
      skipPreflight: false,
      success: `Deposited ${sol(depositLamports)} SOL.`,
    });
  const doBorrow = () =>
    publicKey &&
    borrowBase &&
    run(`Borrow ${usd(borrowBase)} test USD`, borrowIxs(publicKey, borrowBase), {
      // Skip preflight so a rejected borrow still lands onchain with its logs.
      skipPreflight: true,
      success: `Borrowed ${usd(borrowBase)} test USD${afterLtv !== null ? `. LTV now ${pct1(afterLtv)}` : ""}.`,
    });
  const repayBase = parseUnits(repayText, USD_DECIMALS);
  const doRepay = () =>
    publicKey &&
    repayBase &&
    run(`Repay ${usd(repayBase)} test USD`, [repayIx(publicKey, repayBase)], {
      skipPreflight: false,
      success: `Repaid ${usd(repayBase)} test USD.`,
    });
  const withdrawLamports = parseUnits(withdrawText, SOL_DECIMALS);
  const doWithdraw = () =>
    publicKey &&
    withdrawLamports &&
    run(`Withdraw ${sol(withdrawLamports)} SOL`, [withdrawIx(publicKey, withdrawLamports)], {
      skipPreflight: false,
      success: `Withdrew ${sol(withdrawLamports)} SOL.`,
    });

  // Connect.
  const [picking, setPicking] = useState(false);
  const detected = useMemo(
    () => wallets.filter((w) => w.readyState === WalletReadyState.Installed || w.readyState === WalletReadyState.Loadable),
    [wallets],
  );
  const [noWallet, setNoWallet] = useState(false);
  const choose = (name: WalletName) => {
    clearWalletError();
    setPicking(false);
    if (wallet?.adapter.name === name) connect().catch(() => undefined);
    else select(name);
  };
  const onConnect = () => {
    clearWalletError();
    setNoWallet(false);
    if (detected.length === 0) return setNoWallet(true);
    if (detected.length === 1) return choose(detected[0].adapter.name);
    setPicking(true);
  };

  const rpcDown = state?.kind === "error" ? state.message : null;
  const reading = rpcDown ? (
    <div className="tx-line warn reading-error" role="alert">
      <p>
        The live SOL limit is not loading. {rpcDown} Borrowing needs devnet, so wait a moment and try again.
      </p>
      <RetryButton />
    </div>
  ) : (
    <p className="reading" aria-label="SOL feed right now">
      <span>
        SOL live limit <strong>{limit === null ? "--" : pct1(limit)}</strong>
      </span>
      <span className="sep">·</span>
      <span>spot {spot > 0n ? `$${fromE6(spot)}` : "--"}</span>
      <span className="sep">·</span>
      <StatusCell status={status} />
    </p>
  );

  if (!connected || !publicKey) {
    const connectMsg = walletError ? (isWalletRejection(walletError) ? "You cancelled in your wallet." : "Could not connect. Try again or reopen the page in your wallet's browser.") : null;
    return (
      <div className="borrow-intro">
        <div className="borrow-connect">
          <p className="lede">Borrow test USD against devnet SOL. The program checks every borrow against the live limit.</p>
          <div className="hero-actions">
            <button type="button" className="btn btn-primary" onClick={onConnect} disabled={connecting}>
              {connecting ? "Connecting…" : "Connect wallet"}
            </button>
          </div>
          {picking && (
            <div className="wallet-pick" role="group" aria-label="Choose a wallet">
              {detected.map((w) => (
                <button key={w.adapter.name} type="button" className="btn btn-secondary" onClick={() => choose(w.adapter.name)}>
                  {w.adapter.icon && <img src={w.adapter.icon} alt="" width={20} height={20} />}
                  {w.adapter.name}
                </button>
              ))}
            </div>
          )}
          {noWallet && (
            <p className="tx-line warn" role="status">
              No Solana wallet found in this browser. On a phone, open this page inside Phantom. On a computer, install Phantom or Solflare.
            </p>
          )}
          {connectMsg && (
            <p className="tx-line warn" role="status">
              {connectMsg}
            </p>
          )}
          {reading}
        </div>

        <section className="card before" aria-labelledby="before-h">
          <h2 id="before-h">Before you start</h2>
          <ol className="before-list">
            <li>
              <span className="n mono">1</span>
              <span>
                In Phantom, open Settings, then Developer settings. Turn Testnet mode on and choose Solana Devnet.
              </span>
            </li>
            <li>
              <span className="n mono">2</span>
              <span>
                Get devnet SOL at{" "}
                <a className="text-link u" href="https://faucet.solana.com" target="_blank" rel="noopener noreferrer">
                  faucet.solana.com
                </a>
                . It is free and has no value.
              </span>
            </li>
            <li>
              <span className="n mono">3</span>
              <span>On a phone, open this page in Phantom&apos;s in-app browser.</span>
            </li>
          </ol>
        </section>
      </div>
    );
  }

  // Connected.
  const loading = acct === null;
  const hasPosition = !!pos;
  const hasCollateral = collateral > 0n;
  const nextStep: "open" | "deposit" | "borrow" = !hasPosition ? "open" : !hasCollateral ? "deposit" : "borrow";
  const steps: { key: string; node: ReactNode }[] = [];

  if (!loading && !hasPosition) {
    steps.push({
      key: "open",
      node: (
        <>
          <h3>Open position</h3>
          <p className="step-note">Creates your Position account on devnet. One time, a small rent deposit in SOL.</p>
          <div className="step-actions">
            <button type="button" className="btn btn-primary" onClick={doOpen} disabled={busy}>
              Open position
            </button>
          </div>
        </>
      ),
    });
  }

  steps.push({
    key: "deposit",
    node: (
      <>
        <h3>Deposit SOL</h3>
        <p className="step-note">
          Wallet balance <span className="mono">{acct ? `${sol(acct.lamports)} SOL` : "--"}</span>
        </p>
        <div className="step-actions">
          <label className="field">
            <span className="sr-only">SOL to deposit</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              value={depositText}
              onChange={(e) => setDepositText(e.target.value)}
              aria-invalid={depositLamports === null}
            />
            <span className="unit">SOL</span>
          </label>
          <button
            type="button"
            className={`btn ${nextStep === "deposit" ? "btn-primary" : "btn-secondary"}`}
            onClick={doDeposit}
            disabled={busy || !hasPosition || depositLamports === null}
          >
            Deposit
          </button>
        </div>
      </>
    ),
  });

  const sliderCents = borrowBase !== null ? Math.min(sliderMaxCents, Number(borrowBase / 10_000n)) : 0;
  const markLeft = afterLtv === null ? 0 : Math.min(100, afterLtv / 100);
  steps.push({
    key: "borrow",
    node: (
      <>
        <h3>Borrow test USD</h3>
        <p className="step-note">
          {hasCollateral && limit !== null
            ? `Up to ${usd(maxBorrow(debt, value, limit))} test USD fits under the live limit right now.`
            : "Deposit SOL first. Borrowing is checked against its value."}
        </p>
        <div className="borrow-row">
          <input
            type="range"
            className="range"
            min={0}
            max={Math.max(1, sliderMaxCents)}
            step={1}
            value={sliderCents}
            disabled={!hasCollateral}
            aria-label="Test USD to borrow"
            onChange={(e) => {
              touched.current = true;
              setBorrowText((Number(e.target.value) / 100).toFixed(2));
            }}
          />
          <label className="field">
            <span className="sr-only">Test USD to borrow</span>
            <input
              inputMode="decimal"
              autoComplete="off"
              value={borrowText}
              disabled={!hasCollateral}
              onChange={(e) => {
                touched.current = true;
                setBorrowText(e.target.value);
              }}
              aria-invalid={borrowText !== "" && borrowBase === null}
            />
            <span className="unit">USD</span>
          </label>
        </div>

        <div className="after">
          <div className="after-head">
            <span>
              LTV after borrow <strong className="mono">{afterLtv === null ? "--" : afterLtv > 10_000 ? ">100%" : pct1(afterLtv)}</strong>
            </span>
            <span className="mono muted">limit {limit === null ? "--" : pct1(limit)}</span>
          </div>
          <div className="gauge-head">
            <span className="muted" style={{ left: `${cap / 100}%` }}>
              {cap / 100}% cap
            </span>
          </div>
          <Gauge
            limitBps={limit}
            capBps={cap}
            liqBps={liq}
            markBps={afterLtv}
            label={`LTV after borrow ${afterLtv === null ? "unknown" : pct1(afterLtv)}, live limit ${limit === null ? "unknown" : pct1(limit)}`}
          />
          <div className="gauge-head below" aria-hidden>
            {afterLtv !== null && (
              <span className="mark-label" style={{ left: `${Math.min(88, Math.max(12, markLeft))}%` }}>
                after
              </span>
            )}
          </div>
        </div>

        {overLimit && limit !== null && (
          <p className="tx-line warn" role="status">
            Over the live limit of {pct1(limit)}. The program will reject this.
          </p>
        )}
        {!fresh && hasCollateral && (
          <p className="tx-line warn" role="status">
            The SOL price is more than an hour old. The program will pause borrowing until it updates.
          </p>
        )}

        <div className="step-actions">
          {overLimit ? (
            <button type="button" className="btn btn-secondary" onClick={doBorrow} disabled={busy || borrowBase === null || !hasCollateral}>
              Submit anyway
            </button>
          ) : (
            <button
              type="button"
              className={`btn ${nextStep === "borrow" ? "btn-primary" : "btn-secondary"}`}
              onClick={doBorrow}
              disabled={busy || borrowBase === null || !hasCollateral}
            >
              Borrow
            </button>
          )}
        </div>
        {overLimit && (
          <p className="step-note">
            Phantom will warn that this transaction may fail. Confirm it anyway to see the program reject it onchain.
          </p>
        )}
      </>
    ),
  });

  return (
    <div className="borrow-grid">
      <div className="wallet-bar">
        <span className="secondary">
          Connected <span className="mono">{short(publicKey.toBase58())}</span>
        </span>
        <button type="button" className="link-btn" onClick={() => disconnect().catch(() => undefined)}>
          Disconnect
        </button>
      </div>

      <div className="borrow-main">
        <section className="card steps" aria-label="Borrow steps">
          {loading ? (
            <p className="step-note" role="status">
              Reading your position from devnet.
            </p>
          ) : (
            <ol className="step-list">
              {steps.map((s, i) => (
                <li key={s.key} className="step">
                  <span className="step-n mono" aria-hidden>
                    {i + 1}
                  </span>
                  <div className="step-body">{s.node}</div>
                </li>
              ))}
            </ol>
          )}

          {hasPosition && (
            <div className="quiet">
              <h3>Repay or withdraw</h3>
              <div className="quiet-row">
                <label className="field">
                  <span className="sr-only">Test USD to repay</span>
                  <input inputMode="decimal" autoComplete="off" value={repayText} onChange={(e) => setRepayText(e.target.value)} placeholder="0.00" />
                  <span className="unit">USD</span>
                </label>
                <button type="button" className="btn btn-secondary" onClick={doRepay} disabled={busy || repayBase === null || debt === 0n}>
                  Repay
                </button>
              </div>
              <div className="quiet-row">
                <label className="field">
                  <span className="sr-only">SOL to withdraw</span>
                  <input inputMode="decimal" autoComplete="off" value={withdrawText} onChange={(e) => setWithdrawText(e.target.value)} placeholder="0.000" />
                  <span className="unit">SOL</span>
                </label>
                <button type="button" className="btn btn-secondary" onClick={doWithdraw} disabled={busy || withdrawLamports === null || !hasCollateral}>
                  Withdraw
                </button>
              </div>
              <p className="step-note">
                Test USD in your wallet <span className="mono">{acct ? usd(acct.usdBase) : "--"}</span>. Withdrawing with debt is checked against the live limit too.
              </p>
            </div>
          )}

          <TxStatus active={active} last={last} />
        </section>

      </div>

      <aside className="borrow-side">
        <section className="card limit-panel" aria-labelledby="pos-h">
          <div className="big">
            <span className="label" id="pos-h">
              Your LTV
            </span>
            <span className="v">{ltv === null ? "--" : pct1(ltv)}</span>
          </div>
          <div className="gauge-wrap">
            <div className="gauge-head">
              <span className="muted" style={{ left: `${cap / 100}%` }}>
                {cap / 100}% cap
              </span>
            </div>
            <Gauge
              limitBps={limit}
              capBps={cap}
              liqBps={liq}
              markBps={ltv}
              label={`Your LTV ${ltv === null ? "unknown" : pct1(ltv)}, live limit ${limit === null ? "unknown" : pct1(limit)}, cap ${cap / 100}%`}
            />
            <div className="gauge-legend">
              <span>0%</span>
              <span>limit {limit === null ? "--" : pct1(limit)}</span>
            </div>
          </div>
          <dl className="facts">
            <div>
              <dt>Collateral</dt>
              <dd>{pos ? `${sol(collateral)} SOL` : "--"}</dd>
            </div>
            <div>
              <dt>Value at feed spot</dt>
              <dd>{pos && spot > 0n ? `$${fromE6(value)}` : "--"}</dd>
            </div>
            <div>
              <dt>SOL spot</dt>
              <dd>{spot > 0n ? `$${fromE6(spot)}` : "--"}</dd>
            </div>
            <div>
              <dt>Debt</dt>
              <dd>{pos ? `${usd(debt)} test USD` : "--"}</dd>
            </div>
            <div>
              <dt>Live limit</dt>
              <dd>{limit === null ? "--" : pct1(limit)}</dd>
            </div>
            <div>
              <dt>SOL feed</dt>
              <dd>
                <StatusCell status={status} />
              </dd>
            </div>
          </dl>
          {pos && (
            <p className="account-link">
              Position account{" "}
              <a href={explorerAddress(positionPda(publicKey).toBase58())} target="_blank" rel="noopener noreferrer" className="text-link mono">
                {short(positionPda(publicKey).toBase58())}
              </a>{" "}
              on Solana Explorer
            </p>
          )}
          {!loading && !pos && <p className="account-link">No position yet. Open one to start.</p>}
        </section>
      </aside>

      <section className="recent" aria-labelledby="recent-h">
        <h2 id="recent-h">Recent actions</h2>
        {recent.length === 0 ? (
          <p className="step-note">Nothing yet. Actions from this visit show here and are not saved.</p>
        ) : (
          <ul className="recent-list">
            {recent.map((d) => (
              <li key={d.id}>
                <span className={`dot ${d.ok ? "live" : "none"}`} aria-hidden />
                <div className="recent-body">
                  <span className="recent-label">{d.label}</span>
                  <span className="recent-msg">{d.message}</span>
                </div>
                {d.sig ? (
                  <a className="text-link recent-link" href={explorerTx(d.sig)} target="_blank" rel="noopener noreferrer">
                    Explorer
                  </a>
                ) : (
                  <span className="recent-link muted">no tx</span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function TxStatus({ active, last }: { active: Active | null; last: Done | null }) {
  if (active) {
    return (
      <p className="tx-line pending" role="status" aria-live="polite">
        <span className="secondary">{active.label}:</span> {active.phase === "wallet" ? "confirm in your wallet." : "sending to devnet."}
        {active.sig && (
          <>
            {" "}
            <a className="text-link u" href={explorerTx(active.sig)} target="_blank" rel="noopener noreferrer">
              View on Explorer
            </a>
          </>
        )}
      </p>
    );
  }
  if (!last) return <p className="sr-only" role="status" aria-live="polite" />;
  return (
    <p className={`tx-line ${last.ok ? "ok" : "warn"}`} role="status" aria-live="polite">
      {last.message}
      {last.sig && (
        <>
          {" "}
          <a className="text-link u" href={explorerTx(last.sig)} target="_blank" rel="noopener noreferrer">
            View on Explorer
          </a>
        </>
      )}
    </p>
  );
}
