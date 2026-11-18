import type { Symbol } from "@/lib/brace";

/** A letter mark in the asset's colour. Our own drawing, not a brand logo. */
export function AssetGlyph({ sym, size = 32 }: { sym: Symbol; size?: number }) {
  return (
    <span className={`glyph glyph-${sym.toLowerCase()}`} style={{ width: size, height: size, fontSize: size * 0.34 }} aria-hidden>
      {sym === "SOL" ? "S" : sym === "BTC" ? "B" : sym === "ETH" ? "E" : sym === "ZEC" ? "Z" : "X"}
    </span>
  );
}
