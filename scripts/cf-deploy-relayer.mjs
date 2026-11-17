#!/usr/bin/env node
/**
 * Prepare (and document) a Cloudflare Workers scripts-API deploy of brace-relayer.
 *
 * This script does not deploy by itself and never reads or prints RELAYER_SECRET.
 * Bundles with `wrangler deploy --dry-run` (no upload, no token required).
 *
 * Actual upload in this project is done through the connected Cloudflare MCP
 * `execute` tool (PUT /accounts/{account_id}/workers/scripts/brace-relayer)
 * with the bundle passed via $file: substitution.
 *
 * Account ID (not secret): f5541f7a5c900e912b145e07fbc95d63
 * Workers.dev account subdomain (already exists): ohjaye0
 * Expected URL: https://brace-relayer.ohjaye0.workers.dev
 *
 * Vars set on upload: PROGRAM_ID, RPC_URL (from wrangler.toml).
 * Secret set separately: RELAYER_SECRET (base58 64-byte relayer key).
 *
 * PENDING after Task 7 (program on devnet, relayer funded) — do not run now:
 *
 *   PUT /accounts/f5541f7a5c900e912b145e07fbc95d63/workers/scripts/brace-relayer/schedules
 *   body: [{ "cron": "* * * * *" }]
 *
 *   Cloudflare MCP execute (account_id f5541f7a5c900e912b145e07fbc95d63):
 *   async () => {
 *     return cloudflare.request({
 *       method: "PUT",
 *       path: `/accounts/${accountId}/workers/scripts/brace-relayer/schedules`,
 *       body: [{ cron: "* * * * *" }],
 *     });
 *   }
 */
import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const workerDir = resolve(dirname(fileURLToPath(import.meta.url)), "..", "worker");
const distDir = resolve(workerDir, "dist");
mkdirSync(distDir, { recursive: true });

const wrangler = spawnSync(
  "npx",
  ["wrangler", "deploy", "--dry-run", "--outdir", distDir, "--minify"],
  { cwd: workerDir, stdio: "inherit", shell: false },
);
if (wrangler.status !== 0) {
  process.exit(wrangler.status ?? 1);
}

console.log("Bundle ready at", resolve(distDir, "index.js"));
console.log("Upload as ES module index.js with compatibility_date 2026-11-17.");
console.log("Do not attach cron triggers until Task 7.");
console.log("Do not print or commit RELAYER_SECRET.");
