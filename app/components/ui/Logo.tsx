import { useId } from "react";

/**
 * Brace's mark: a shield with one curly brace inside. The shield is the limit that protects the
 * pool, the brace is the name. Solana gradient (#9945FF to #14F195), white brace, reads at 16px.
 * Same geometry as app/icon.svg.
 */
export function Logo({ size = 24, className = "" }: { size?: number; className?: string }) {
  const id = `bl${useId().replace(/:/g, "")}`;
  return (
    <svg className={`logo-mark ${className}`} width={size} height={size} viewBox="0 0 32 32" aria-hidden focusable="false">
      <defs>
        <linearGradient id={id} x1="6" y1="3" x2="26" y2="29" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#9945FF" />
          <stop offset="1" stopColor="#14F195" />
        </linearGradient>
      </defs>
      <path d={SHIELD} fill={`url(#${id})`} />
      <path d={BRACE} fill="none" stroke="#fff" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export const SHIELD = "M16 2.8 26.6 6.4V15.2C26.6 21.6 22.2 26.4 16 29.2 9.8 26.4 5.4 21.6 5.4 15.2V6.4Z";
export const BRACE = "M18.8 9c-2.1 0-3 .9-3 2.8v1.3c0 1.5-.7 2.4-2.5 2.8 1.8.4 2.5 1.3 2.5 2.8v1.3c0 1.9.9 2.8 3 2.8";
