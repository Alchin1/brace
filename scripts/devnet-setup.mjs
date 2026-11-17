#!/usr/bin/env node
/**
 * Brace Task 7 one-shot: deploy, initialize, init_pool, and first SOL post_quotes
 * back to back (Pass 5 F1: do not leave a gap where users can deposit before a
 * SOL Feed exists).
 *
 * Does NOT run anything destructive unless you pass --execute.
 * Default is --dry-run: prints the plan, checks balances, previews the SOL
 * ladder from Gemini, and exits.
 *
 * Keys are read from paths only. Never prints key material.
 *
 *   cd scripts && npm install
 *   node devnet-setup.mjs              # dry-run
 *   node devnet-setup.mjs --execute    # only after the keys are funded
 *
 * Env (optional):
 *   DEPLOYER_KEY  default ~/keys/deployer.json
 *   RELAYER_KEY   default ~/keys/relayer.json
 *   RPC_URL       default https://api.devnet.solana.com
 *   REPO_ROOT     default parent of this scripts/ directory
 */
import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { AnchorProvider, BN, Program, Wallet } from "@anchor-lang/core";
import {
  ComputeBudgetProgram,
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";

const PROGRAM_ID = new PublicKey("Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC");
const RPC_URL = process.env.RPC_URL || "https://api.devnet.solana.com";
const REPO_ROOT = resolve(process.env.REPO_ROOT || join(dirname(fileURLToPath(import.meta.url)), ".."));
const DEPLOYER_KEY = resolve(process.env.DEPLOYER_KEY || join(homedir(), "keys/deployer.json"));
const RELAYER_KEY = resolve(process.env.RELAYER_KEY || join(homedir(), "keys/relayer.json"));
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

const DEFAULT_PARAMS = {
  govMaxLtvBps: 7500,
  liqThresholdBps: 8000,
  horizonSecs: 86_400,
  kX100: 300,
  absFloorLtvBps: 3000,
  staleSecs: 300,
  staleStepBps: 250,
  staleFloorLtvBps: 5000,
  maxSpreadBps: 1500,
  minPoints: 3,
  minExpirySecs: 900,
  maxExpirySecs: 259_200,
  maxSpotGapBps: 300,
};

const SOL_SYMBOL = Buffer.from("SOL\0\0\0\0\0", "ascii");
const MIN_DEPLOYER_SOL = 4;
const MIN_RELAYER_SOL = 0.05;

const execute = process.argv.includes("--execute");

function loadKeypair(path) {
  if (!existsSync(path)) {
    throw new Error(`keypair file not found: ${path}`);
  }
  const raw = JSON.parse(readFileSync(path, "utf8"));
  if (!Array.isArray(raw)) {
    throw new Error(`expected a JSON byte array in ${path}`);
  }
  return Keypair.fromSecretKey(Uint8Array.from(raw));
}

function expandHome(p) {
  return p.startsWith("~/") ? join(homedir(), p.slice(2)) : p;
}

/** Parse a decimal string into an integer with `scale` fraction digits. No floats. */
function decimalToScaled(s, scale) {
  if (typeof s !== "string" || s.length === 0) return null;
  const t = s.trim();
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const [whole, frac = ""] = t.split(".");
  const digits = (whole + frac.padEnd(scale, "0").slice(0, scale)).replace(/^0+(?=\d)/, "") || "0";
  if (frac.length > scale) {
    // Truncate extra digits rather than rounding with floats.
  }
  try {
    return BigInt(digits);
  } catch {
    return null;
  }
}

function padBytes(s, len) {
  const buf = Buffer.alloc(len);
  Buffer.from(String(s), "utf8").copy(buf, 0, 0, len);
  return Array.from(buf);
}

function pda(seeds) {
  return PublicKey.findProgramAddressSync(seeds, PROGRAM_ID)[0];
}

async function fetchSolLadder() {
  const evRes = await fetch(
    "https://api.gemini.com/v1/prediction-markets/events?status=active&limit=200&category=crypto",
  );
  if (!evRes.ok) throw new Error(`Gemini events HTTP ${evRes.status}`);
  const evJson = await evRes.json();
  const events = evJson.data || evJson.events || evJson;
  if (!Array.isArray(events)) throw new Error("unexpected Gemini events shape");

  const tickRes = await fetch("https://api.gemini.com/v1/pubticker/solusd");
  if (!tickRes.ok) throw new Error(`Gemini pubticker HTTP ${tickRes.status}`);
  const tickJson = await tickRes.json();
  const spotE6 = decimalToScaled(String(tickJson.last ?? ""), 6);
  if (spotE6 === null || spotE6 <= 0n) throw new Error(`bad pubticker last: ${tickJson.last}`);

  const now = Math.floor(Date.now() / 1000);
  const minExp = now + 900;
  const maxExp = now + 259_200;

  const candidates = [];
  for (const ev of events) {
    const ticker = String(ev.ticker || ev.eventTicker || "");
    if (!ticker.startsWith("SOL2")) continue;
    const expiryRaw = ev.expiryDate || ev.expiry_date || ev.expiration || ev.expiresAt;
    const expiryTs = expiryRaw ? Math.floor(new Date(expiryRaw).getTime() / 1000) : 0;
    if (expiryTs < minExp || expiryTs > maxExp) continue;
    const contracts = ev.contracts || ev.contractList || [];
    const quotes = [];
    for (const c of contracts) {
      const strikeObj = c.strike || {};
      const typ = String(strikeObj.type || c.type || "").toLowerCase();
      if (typ && typ !== "above") continue;
      const prices = c.prices || c.price || {};
      const bidS = prices.bestBid ?? prices.best_bid ?? c.bestBid ?? "";
      const askS = prices.bestAsk ?? prices.best_ask ?? c.bestAsk ?? "";
      const bid = decimalToScaled(String(bidS || ""), 4); // 0.44 -> 4400 bps
      const ask = decimalToScaled(String(askS || ""), 4);
      const strikeVal = strikeObj.value ?? c.strikePrice ?? c.strike;
      const strikeE6 = decimalToScaled(String(strikeVal ?? ""), 6);
      if (bid === null || ask === null || strikeE6 === null) continue;
      if (bid === 0n || ask === 0n) continue;
      if (ask < bid) continue;
      if (ask - bid > 1500n) continue;
      const mid = (bid + ask) / 2n;
      if (mid < 300n || mid > 9700n) continue;
      quotes.push({
        strikeE6,
        bidBps: Number(bid),
        askBps: Number(ask),
        mid: Number(mid),
      });
    }
    if (quotes.length >= 4) {
      candidates.push({ ticker, expiryTs, quotes });
    }
  }
  if (candidates.length === 0) {
    throw new Error("no valid SOL ladder (need >=4 tight above-contracts in the 15m-72h window)");
  }
  candidates.sort((a, b) => a.expiryTs - b.expiryTs);
  const best = candidates[0];
  best.quotes.sort((a, b) => Math.abs(a.mid - 5000) - Math.abs(b.mid - 5000));
  const quotes = best.quotes.slice(0, 16).map((q) => ({
    strikeE6: new BN(q.strikeE6.toString()),
    bidBps: q.bidBps,
    askBps: q.askBps,
  }));
  return {
    ticker: best.ticker,
    expiryTs: best.expiryTs,
    spotE6: new BN(spotE6.toString()),
    quotes,
    nCandidates: candidates.length,
    nKept: best.quotes.length,
  };
}

function sol(lamports) {
  return (Number(lamports) / 1_000_000_000).toFixed(9);
}

async function main() {
  const deployer = loadKeypair(expandHome(DEPLOYER_KEY));
  const relayer = loadKeypair(expandHome(RELAYER_KEY));
  const connection = new Connection(RPC_URL, "confirmed");

  const configPda = pda([Buffer.from("config")]);
  const poolPda = pda([Buffer.from("pool")]);
  const mintPda = pda([Buffer.from("usd_mint")]);
  const feedPda = pda([Buffer.from("feed"), SOL_SYMBOL]);

  const depLamports = await connection.getBalance(deployer.publicKey);
  const relLamports = await connection.getBalance(relayer.publicKey);

  console.log("mode:          ", execute ? "EXECUTE (will deploy)" : "dry-run (no transactions)");
  console.log("rpc:           ", RPC_URL);
  console.log("program id:    ", PROGRAM_ID.toBase58());
  console.log("deployer:      ", deployer.publicKey.toBase58(), sol(depLamports), "SOL");
  console.log("relayer:       ", relayer.publicKey.toBase58(), sol(relLamports), "SOL");
  console.log("config PDA:    ", configPda.toBase58());
  console.log("pool PDA:      ", poolPda.toBase58());
  console.log("usd_mint PDA:  ", mintPda.toBase58());
  console.log("SOL feed PDA:  ", feedPda.toBase58());

  let ladder;
  try {
    ladder = await fetchSolLadder();
    console.log(
      `SOL ladder:    ticker=${ladder.ticker} expiry=${ladder.expiryTs} spot_e6=${ladder.spotE6.toString()} quotes=${ladder.quotes.length} (from ${ladder.nKept} tight, ${ladder.nCandidates} expiries)`,
    );
  } catch (e) {
    console.log("SOL ladder:    FAILED to fetch/select:", e.message || e);
  }

  const depSol = depLamports / 1_000_000_000;
  const relSol = relLamports / 1_000_000_000;
  if (depSol < MIN_DEPLOYER_SOL || relSol < MIN_RELAYER_SOL) {
    console.log(
      `funds:         insufficient (need >= ${MIN_DEPLOYER_SOL} SOL deployer, >= ${MIN_RELAYER_SOL} SOL relayer). Fund at faucet.solana.com (Devnet), then re-run.`,
    );
    if (execute) {
      throw new Error("refusing to execute: keys are not funded");
    }
  }

  if (!execute) {
    console.log("");
    console.log("Plan (not run):");
    console.log("  1. anchor deploy --provider.cluster devnet --provider.wallet <deployer>");
    console.log("  2. initialize(DEFAULT_PARAMS, relayer) signed by deployer");
    console.log("  3. init_pool() signed by deployer");
    console.log("  4. read Config and assert admin==deployer, relayer==relayer");
    console.log("  5. post_quotes(SOL, live Gemini ladder) signed by relayer, CU limit 120k");
    console.log("  6. read SOL Feed and print confident / sigma_bps / max_ltv");
    console.log("Re-run with --execute after the keys are funded. Do not leave a gap between init_pool and the first SOL post.");
    return;
  }

  const deploy = spawnSync(
    "anchor",
    ["deploy", "--provider.cluster", "devnet", "--provider.wallet", expandHome(DEPLOYER_KEY)],
    { cwd: REPO_ROOT, stdio: "inherit", env: process.env },
  );
  if (deploy.status !== 0) {
    throw new Error(`anchor deploy failed with status ${deploy.status}`);
  }

  const idlPath = join(REPO_ROOT, "target/idl/brace.json");
  const idl = JSON.parse(readFileSync(idlPath, "utf8"));
  const wallet = new Wallet(deployer);
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  // Anchor 1.x: Program(idl, provider) reads the address from the IDL.
  const program = new Program(idl, provider);

  const initSig = await program.methods
    .initialize(DEFAULT_PARAMS, relayer.publicKey)
    .accounts({
      admin: deployer.publicKey,
      config: configPda,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("initialize sig:", initSig);

  const poolSig = await program.methods
    .initPool()
    .accounts({
      admin: deployer.publicKey,
      config: configPda,
      pool: poolPda,
      usdMint: mintPda,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .rpc();
  console.log("init_pool sig: ", poolSig);

  const cfg = await program.account.config.fetch(configPda);
  if (!cfg.admin.equals(deployer.publicKey) || !cfg.relayer.equals(relayer.publicKey)) {
    throw new Error(
      `Config mismatch: admin=${cfg.admin.toBase58()} relayer=${cfg.relayer.toBase58()}`,
    );
  }
  console.log("config ok:     admin=deployer, relayer=relayer");

  if (!ladder) throw new Error("no SOL ladder to post");
  const postSig = await program.methods
    .postQuotes(padBytes("SOL", 8), new BN(ladder.expiryTs), padBytes(ladder.ticker, 32), ladder.spotE6, ladder.quotes)
    .accounts({
      relayer: relayer.publicKey,
      config: configPda,
      feed: feedPda,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions([ComputeBudgetProgram.setComputeUnitLimit({ units: 120_000 })])
    .signers([relayer])
    .rpc();
  console.log("post_quotes sig:", postSig);

  const feed = await program.account.feed.fetch(feedPda);
  console.log(
    `SOL feed:      confident=${feed.confident} sigma_bps=${feed.sigmaBps} max_ltv=${feed.maxLtvBps} points=${feed.points} spot_e6=${feed.spotE6} median_e6=${feed.medianE6}`,
  );
  if (!feed.confident) {
    throw new Error("first SOL post was not confident; inspect the ladder and retry post_quotes only");
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
