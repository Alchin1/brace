#!/usr/bin/env bash
# Builds a static preview of Demo.tsx (app globals.css + patterns.css) into $OUT (default /tmp/rv-preview)
# so it can be opened in a browser or screenshotted. Touches nothing in app/.
set -euo pipefail
HERE="$(cd "$(dirname "$0")/.." && pwd)"
APP_CSS="$HERE/../../../app/app/globals.css"
OUT="${OUT:-/tmp/rv-preview}"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
cd "$WORK"
npm init -y >/dev/null
npm i --no-audit --no-fund --silent react@19.3.1 react-dom@19.3.1 esbuild@0.25 >/dev/null
mkdir src && cp "$HERE"/*.ts "$HERE"/*.tsx "$HERE"/*.css src/
cat > entry.tsx <<'J'
import { createRoot } from "react-dom/client";
import { Demo } from "./src/Demo";
createRoot(document.getElementById("root")!).render(<Demo />);
J
mkdir -p "$OUT"
npx esbuild entry.tsx --bundle --minify --format=esm --jsx=automatic --define:process.env.NODE_ENV='"production"' --log-level=warning --outfile="$OUT/app.js"
npx esbuild src/patterns.css --bundle --log-level=warning --outfile="$OUT/patterns.css"
cp "$APP_CSS" "$OUT/globals.css"
cat > "$OUT/index.html" <<'H'
<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Brace patterns preview</title>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Geist:wght@400;500;600&family=Geist+Mono:wght@400;500&display=swap">
<style>:root{--font-geist-sans:"Geist";--font-geist-mono:"Geist Mono"}</style>
<link rel="stylesheet" href="globals.css"><link rel="stylesheet" href="patterns.css">
<script>try{var t=new URLSearchParams(location.search).get("theme");if(t)document.documentElement.setAttribute("data-theme",t)}catch(e){}</script>
</head><body><div id="root"></div><script type="module" src="app.js"></script></body></html>
H
echo "preview: $OUT/index.html"
