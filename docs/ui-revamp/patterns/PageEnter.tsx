import type { ReactNode } from "react";

/*
 * DEFAULT page enter: CSS keyframe, no JS runtime. Use from app/template.tsx, which re-mounts
 * on each navigation so the animation replays. Same feel as PageTransition.tsx (motion).
 */
export function PageTransitionCss({ children }: { children: ReactNode }) {
  return <div className="rv-page-enter">{children}</div>;
}
