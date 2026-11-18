"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  parseBlocked,
  parseUnits,
  priceFresh,
  type Position,
} from "@/lib/position";
import { borrowIxs, depositIx, openPositionIx, positionPda, repayIx, usdAta, withdrawIx } from "@/lib/tx";
import { useBoard } from "../BoardProvider";
import { borrowTextAfter } from "../ui/display";
import { ConnectedView, DisconnectedView } from "./BorrowView";

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
type Done = { id: number; label: string; ok: boolean; message: string; sig: string | null; at: number; blocked?: { ltvBps: number; limitBps: number } | null };
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
    async (label: string, ixs: TransactionInstruction[], opts: { skipPreflight: boolean; success: string; onDone?: (ok: boolean) => void }) => {
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
          done = { id, label, ok: false, message: failureMessage(conf.value.err, logs), sig, at: Date.now(), blocked: parseBlocked(logs) };
        } else {
          done = { id, label, ok: true, message: opts.success, sig, at: Date.now() };
        }
      } catch (e) {
        const logs = (e as { logs?: string[] }).logs ?? (sig ? await fetchLogs(sig) : null);
        done = { id, label, ok: false, message: failureMessage(e, logs), sig, at: Date.now(), blocked: parseBlocked(logs) };
      }
      setActive(null);
      setLast(done);
      setRecent((r) => [done, ...r].slice(0, 12));
      opts.onDone?.(done.ok);
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
      // A confirmed borrow clears the amount, so the old figure is not re-checked against the new debt.
      onDone: (ok) => setBorrowText((t) => borrowTextAfter(ok, t)),
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
  const feedView = {
    limit,
    status,
    cap,
    liq,
    spotText: spot > 0n ? `$${fromE6(spot)}` : "--",
    fresh,
    rpcDown,
  };

  if (!connected || !publicKey) {
    const connectMsg = walletError ? (isWalletRejection(walletError) ? "You cancelled in your wallet." : "Could not connect. Try again or reopen the page in your wallet's browser.") : null;
    return (
      <DisconnectedView
        {...feedView}
        connecting={connecting}
        onConnect={onConnect}
        picking={picking}
        detected={detected.map((w) => ({ name: w.adapter.name, icon: w.adapter.icon || null }))}
        onChoose={(name) => choose(name as WalletName)}
        noWallet={noWallet}
        connectMsg={connectMsg}
      />
    );
  }

  // Connected.
  const loading = acct === null;
  const hasPosition = !!pos;
  const hasCollateral = collateral > 0n;
  const nextStep: "open" | "deposit" | "borrow" = !hasPosition ? "open" : !hasCollateral ? "deposit" : "borrow";
  const sliderCents = borrowBase !== null ? Math.min(sliderMaxCents, Number(borrowBase / 10_000n)) : 0;
  const posAddr = positionPda(publicKey).toBase58();

  return (
    <ConnectedView
      {...feedView}
      address={short(publicKey.toBase58())}
      onDisconnect={() => disconnect().catch(() => undefined)}
      loading={loading}
      hasPosition={hasPosition}
      hasCollateral={hasCollateral}
      nextStep={nextStep}
      ltv={ltv}
      collateralText={pos ? `${sol(collateral)} SOL` : null}
      valueText={pos && spot > 0n ? `$${fromE6(value)}` : null}
      debtText={pos ? `${usd(debt)} test USD` : null}
      walletSolText={acct ? `${sol(acct.lamports)} SOL` : null}
      walletUsdText={acct ? usd(acct.usdBase) : null}
      deposit={{ text: depositText, set: setDepositText, valid: depositLamports !== null }}
      borrow={{
        text: borrowText,
        set: setBorrowText,
        valid: borrowBase !== null,
        sliderMax: sliderMaxCents,
        sliderValue: sliderCents,
        onSlide: (cents) => {
          touched.current = true;
          setBorrowText((cents / 100).toFixed(2));
        },
        onType: (v) => {
          touched.current = true;
          setBorrowText(v);
        },
      }}
      repay={{ text: repayText, set: setRepayText, valid: repayBase !== null, disabled: debt === 0n }}
      withdraw={{ text: withdrawText, set: setWithdrawText, valid: withdrawLamports !== null, disabled: !hasCollateral }}
      afterLtv={afterLtv}
      overLimit={overLimit}
      maxBorrowText={hasCollateral && limit !== null ? usd(maxBorrow(debt, value, limit)) : null}
      busy={busy}
      onOpen={() => void doOpen()}
      onDeposit={() => void doDeposit()}
      onBorrow={() => void doBorrow()}
      onRepay={() => void doRepay()}
      onWithdraw={() => void doWithdraw()}
      active={active}
      last={last}
      recent={recent}
      positionHref={pos ? explorerAddress(posAddr) : null}
      positionShort={pos ? short(posAddr) : null}
      explorerTx={explorerTx}
    />
  );
}
