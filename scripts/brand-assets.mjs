// Regenerates Brace's brand images from app/app/icon.svg (the shield and brace mark):
//   app/app/favicon.ico (16, 32, 48), app/app/apple-icon.png (180), app/public/icon-192.png,
//   app/public/icon-512.png, and app/app/opengraph-image.jpg / twitter-image.jpg (1200x630, no numbers).
// Needs Playwright with Chromium (`npx playwright install chromium`) and Python 3 with Pillow.
// Run from the repo root: node scripts/brand-assets.mjs
import { chromium } from "playwright";
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const app = join(root, "app");
const tmp = mkdtempSync(join(tmpdir(), "brace-brand-"));
const mark = readFileSync(join(app, "app/icon.svg"), "utf8");
// The same mark on a dark tile with margin, for home screen icons (iOS fills transparency with black).
const tile = mark
  .replace('viewBox="0 0 32 32"', 'viewBox="-6 -6 44 44"')
  .replace("</defs>", '</defs><rect x="-6" y="-6" width="44" height="44" fill="#100d26"/>');

const browser = await chromium.launch();
async function png(svg, size, file) {
  const page = await browser.newPage({ viewport: { width: size, height: size } });
  await page.setContent(`<body style="margin:0">${svg.replace("<svg ", `<svg width="${size}" height="${size}" `)}</body>`);
  await page.screenshot({ path: file, omitBackground: true, clip: { x: 0, y: 0, width: size, height: size } });
  await page.close();
}
for (const s of [16, 32, 48]) await png(mark, s, join(tmp, `f${s}.png`));
await png(tile, 180, join(app, "app/apple-icon.png"));
await png(tile, 192, join(app, "public/icon-192.png"));
await png(tile, 512, join(app, "public/icon-512.png"));

const hero = `file://${join(app, "public/scene/hero-dark.webp")}`;
const og = `<html><head><style>
body{margin:0;width:1200px;height:630px;overflow:hidden;font-family:Geist,system-ui,sans-serif;color:#f4f1ff;
  background:#0c0a22 url(${hero}) no-repeat;background-size:1240px 698px;background-position:150px -40px;position:relative}
.shade{position:absolute;inset:0;background:linear-gradient(90deg,#0c0a22 0%,rgba(12,10,34,.92) 38%,rgba(12,10,34,0) 66%)}
.c{position:absolute;left:72px;top:64px;width:640px;display:flex;flex-direction:column;height:502px}
.brand{display:flex;align-items:center;gap:14px;font-size:34px;font-weight:500}
.net{font-family:"Geist Mono",monospace;font-size:18px;color:#b3abd9;border-left:1px solid rgba(255,255,255,.18);padding-left:14px;margin-left:2px}
h1{font-size:68px;line-height:1.04;font-weight:500;margin:64px 0 0;letter-spacing:-.02em} h1 span{color:#c4a1ff}
p{font-size:25px;line-height:1.4;color:#cfc8ef;margin:24px 0 0;width:560px}
.foot{margin-top:auto;font-family:"Geist Mono",monospace;font-size:19px;color:#b3abd9;display:flex;gap:22px} .foot b{font-weight:400;color:#14F195}
</style></head><body><div class="shade"></div><div class="c">
<div class="brand">${mark.replace("<svg ", '<svg width="52" height="52" ')}Brace<span class="net">devnet</span></div>
<h1>Lending limits that move <span>before</span> the market does</h1>
<p>Gemini prediction market odds, turned into borrow limits onchain on Solana.</p>
<div class="foot"><b>braced.vercel.app</b><span>SOL BTC ETH XRP ZEC</span></div></div></body></html>`;
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
writeFileSync(join(tmp, "og.html"), og);
await page.goto(`file://${tmp}/og.html`, { waitUntil: "load" });
await page.waitForTimeout(400);
await page.screenshot({ path: join(tmp, "og.png") });
await browser.close();

execFileSync("python3", ["-c", `
from PIL import Image
t = ${JSON.stringify(tmp)}; a = ${JSON.stringify(app)}
ims = [Image.open(f"{t}/f{s}.png").convert("RGBA") for s in (16, 32, 48)]
ims[2].save(f"{a}/app/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ims[:2])
og = Image.open(f"{t}/og.png").convert("RGB")
for n in ("opengraph-image.jpg", "twitter-image.jpg"):
    og.save(f"{a}/app/{n}", quality=88, optimize=True, progressive=True)
`]);
console.log("brand assets written");
