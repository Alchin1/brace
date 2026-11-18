/**
 * The Brace mark: two curly braces closing on a limit line.
 * `open` spreads the braces apart (used on the 404). Decorative by default.
 */
export function BraceMark({ size = 24, open = false, className = "" }: { size?: number; open?: boolean; className?: string }) {
  return (
    <svg
      className={`brace-mark${open ? " is-open" : ""} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden
      focusable="false"
    >
      <path
        className="bm-left"
        d="M11 5.5c-2.6 0-3.6 1.2-3.6 3.6v3.4c0 1.9-.9 3-2.9 3.5 2 .5 2.9 1.6 2.9 3.5v3.4c0 2.4 1 3.6 3.6 3.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        className="bm-right"
        d="M21 5.5c2.6 0 3.6 1.2 3.6 3.6v3.4c0 1.9.9 3 2.9 3.5-2 .5-2.9 1.6-2.9 3.5v3.4c0 2.4-1 3.6-3.6 3.6"
        stroke="currentColor"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <rect className="bm-line" x="12.5" y="14.8" width="7" height="2.4" rx="1.2" />
    </svg>
  );
}
