/*
 * Loading placeholder with a slow shimmer, for "Reading devnet" states.
 * From motionsites: skeleton + `shimmer` keyframe (translate to 100%, 1.6s infinite).
 * Brace: the parent must still render a text status ("Reading devnet") for screen readers
 * and for honesty; the skeleton is decoration (aria-hidden). Reduced motion: static.
 */

export function Skeleton({ width = "6ch", height = "1em", className }: { width?: string; height?: string; className?: string }) {
  return <span className={`rv-skel ${className ?? ""}`} style={{ width, height }} aria-hidden />;
}
