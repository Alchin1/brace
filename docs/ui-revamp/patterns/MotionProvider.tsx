"use client";

// OPTIONAL motion version. The default is the CSS version (RevealCss.tsx / PageEnter.tsx),
// which looks the same and ships without the motion runtime. See patterns/README.md for sizes.

import { LazyMotion, MotionConfig } from "motion/react";
import type { ReactNode } from "react";

/**
 * Wrap the app once (in app/layout.tsx, inside <body>).
 *
 * - LazyMotion loads the animation features (domAnimation) in a separate chunk after first
 *   paint, and the patterns use the small `m.*` components, not `motion.*`. `strict` makes a
 *   stray `motion.div` throw in development so the bundle stays small.
 * - Caveat measured in check/check.sh: server HTML renders `m.*` elements at their `initial`
 *   style (e.g. opacity:0) until the client animates them, so never put above-the-fold or
 *   live content inside motion reveals.
 * - reducedMotion="user": when the OS asks for less motion, motion skips transform and
 *   layout animation and keeps only opacity. The CSS floor in tokens.css covers the rest.
 */
const loadFeatures = () => import("./motion-features").then((mod) => mod.default);

export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user" transition={{ duration: 0.42, ease: [0.22, 1, 0.36, 1] }}>
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}
