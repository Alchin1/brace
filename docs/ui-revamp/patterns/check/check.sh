#!/usr/bin/env bash
# Throwaway check for docs/ui-revamp/patterns. Touches nothing in app/.
#  1. typecheck every pattern with the app's TypeScript, React types and compiler options
#  2. server-render Demo.tsx with react-dom/server (catches runtime errors in render)
#  3. bundle Demo for the browser (minified) and report gzip sizes, total and motion's share
# Needs Node 20+ and network for npm. Versions mirror app/package-lock.json; motion is the
# only new dependency the revamp would add.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
npm init -y >/dev/null
npm i --no-audit --no-fund --silent react@19.3.1 react-dom@19.3.1 @types/react@19.3.0 @types/react-dom@19.3.0 typescript@5.9.3 motion@14.14.0 esbuild@0.25 >/dev/null
mkdir src && cp "$HERE"/*.ts "$HERE"/*.tsx "$HERE"/*.css src/
cat > tsconfig.json <<'J'
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": false,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve"
  },
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
J
echo "== typecheck"
npx tsc -p tsconfig.json && echo "tsc: 0 errors"

echo "== server render"
cat > ssr.tsx <<'J'
import { renderToString } from "react-dom/server";
import { Demo } from "./src/Demo";
const html = renderToString(<Demo path="/" />);
const must = ["Lending limits that", "Every asset, every minute", "Frv6CVJKADmkM2cnBSMKgBWPvtHsfYkfye5d4vB84WyC", "Try a borrow", "SOL"];
const missing = must.filter((m) => !html.includes(m));
if (missing.length) { console.error("missing in SSR html:", missing); process.exit(1); }
require("fs").writeFileSync("ssr.html", html);
console.log(`ssr: ok, ${html.length} chars of html`);
J
npx esbuild ssr.tsx --bundle --platform=node --format=cjs --jsx=automatic --log-level=warning --outfile=ssr.js
node ssr.js

echo "== browser bundle"
cat > entry.tsx <<'J'
import { createRoot } from "react-dom/client";
import { Demo } from "./src/Demo";
createRoot(document.getElementById("root")!).render(<Demo />);
J
cat > entry-motion.tsx <<'J'
import { createRoot } from "react-dom/client";
import { DemoMotion } from "./src/DemoMotion";
createRoot(document.getElementById("root")!).render(<DemoMotion />);
J
cat > entry-react.tsx <<'J'
import { createRoot } from "react-dom/client";
createRoot(document.getElementById("root")!).render(null);
J
for e in entry entry-motion entry-react; do
  npx esbuild $e.tsx --bundle --minify --format=esm --jsx=automatic --define:process.env.NODE_ENV='"production"' --log-level=warning --outfile=out/$e.js
done
node -e '
const fs=require("fs"),z=require("zlib");
const gz=(f)=>z.gzipSync(fs.readFileSync(f),{level:9}).length;
const kb=(n)=>(n/1024).toFixed(1)+" KB";
const r=gz("out/entry-react.js"),d=gz("out/entry.js"),m=gz("out/entry-motion.js");
console.log(`react-dom alone: ${kb(r)} gzip (baseline, already in the app)`);
console.log(`all default patterns (CSS motion): +${kb(d-r)} gzip over react-dom`);
console.log(`optional motion versions (LazyMotion + m + PageTransition): +${kb(m-r)} gzip over react-dom`);
'
npx esbuild src/patterns.css --bundle --minify --log-level=warning --outfile=out/app.css
node -e 'const fs=require("fs"),z=require("zlib");const c=fs.readFileSync("out/app.css");console.log(`css: ${(c.length/1024).toFixed(1)} KB min, ${(z.gzipSync(c,{level:9}).length/1024).toFixed(1)} KB gzip`)'
# Does server HTML hide revealed content before motion loads? Report it honestly.
node -e 'const h=require("fs").readFileSync("ssr.html","utf8");const n=(h.match(/opacity:0/g)||[]).length;console.log(`ssr: ${n} elements start at opacity:0 (must be 0 for the default CSS patterns)`)'
echo "== patterns check passed"
