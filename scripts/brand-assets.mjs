// Regenerates the brand images in app/app: icon (512px, then resized to icon.png, apple-icon.png and
// favicon.ico with PIL) and opengraph-image.png / twitter-image.png (1200x630, no live numbers).
// Needs playwright-core and Chrome; renders with the live site fonts. Output goes to OUT.
import { chromium } from 'playwright-core';
const OUT = '/workspace/b6/assets';
const browser = await chromium.launch({ executablePath: '/usr/bin/google-chrome', args: ['--no-sandbox'] });
async function render(w, h, html, file, transparent = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, colorScheme: 'light' });
  const page = await ctx.newPage();
  await page.goto('https://brace-ivory.vercel.app/about', { waitUntil: 'networkidle' });
  await page.evaluate((html) => {
    document.documentElement.setAttribute('data-theme', 'light');
    document.body.innerHTML = html;
    document.body.style.margin = '0';
    document.body.style.background = 'transparent';
    document.documentElement.style.background = 'transparent';
  }, html);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  await page.screenshot({ path: `${OUT}/${file}`, omitBackground: transparent, clip: { x: 0, y: 0, width: w, height: h } });
  await ctx.close();
}
// Icon: solid accent square, white B in the Geist wordmark weight.
const icon = `<div style="width:512px;height:512px;border-radius:112px;background:#7b2ff2;display:flex;align-items:center;justify-content:center;font-family:var(--sans);font-weight:600;color:#fff;font-size:360px;letter-spacing:-0.04em;line-height:1"><span style="transform:translateY(-6px)">B</span></div>`;
await render(512, 512, icon, 'icon-512.png', true);
// Curve: a falling probability ladder like the board chart, no numbers.
const pts = [];
for (let i = 0; i <= 60; i++) { const x = i / 60; const y = 1 / (1 + Math.exp((x - 0.5) * 11)); pts.push(`${(40 + x * 400).toFixed(1)},${(40 + (1 - y) * 300).toFixed(1)}`); }
const dots = [0.22, 0.32, 0.4, 0.47, 0.53, 0.6, 0.68, 0.78].map((x, i) => { const y = 1 / (1 + Math.exp((x - 0.5) * 11)) + [0.02, -0.03, 0.025, -0.02, 0.03, -0.025, 0.02, -0.015][i]; return `<circle cx="${40 + x * 400}" cy="${40 + (1 - y) * 300}" r="6" fill="#171717"/>`; }).join('');
const og = `<div style="width:1200px;height:630px;background:#fafafa;color:#171717;font-family:var(--sans);display:flex;box-sizing:border-box;padding:64px 72px;position:relative">
  <div style="flex:1;display:flex;flex-direction:column;justify-content:space-between">
    <div style="display:flex;align-items:baseline;gap:12px"><span style="font-size:34px;font-weight:600;letter-spacing:-0.02em">Brace</span><span style="font-family:var(--mono);font-size:20px;color:#737373">devnet</span></div>
    <div>
      <div style="font-size:64px;font-weight:600;letter-spacing:-0.035em;line-height:1.06;max-width:12.5ch">Lending limits that move before the market does</div>
      <div style="margin-top:24px;font-size:24px;line-height:1.45;color:#525252;max-width:30ch">Gemini prediction markets, turned into an onchain volatility oracle for Solana lending.</div>
    </div>
    <div style="font-family:var(--mono);font-size:19px;color:#737373;display:flex;gap:32px;white-space:nowrap"><span>SOL · BTC · ETH · XRP · ZEC</span><span>brace-ivory.vercel.app</span></div>
  </div>
  <div style="width:480px;display:flex;align-items:center;justify-content:center">
    <svg width="480" height="380" viewBox="0 0 480 380"><rect x="1" y="1" width="478" height="378" rx="16" fill="#ffffff" stroke="rgba(23,23,23,0.14)"/>
      <line x1="40" y1="190" x2="440" y2="190" stroke="rgba(23,23,23,0.08)"/><line x1="240" y1="40" x2="240" y2="340" stroke="rgba(23,23,23,0.25)"/>
      <polyline points="${pts.join(' ')}" fill="none" stroke="#7b2ff2" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>${dots}</svg>
  </div>
</div>`;
await render(1200, 630, og, 'og-1200x630.png');
await browser.close();
