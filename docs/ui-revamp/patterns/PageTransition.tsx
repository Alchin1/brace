"use client";

// OPTIONAL motion version. The default is the CSS version (RevealCss.tsx / PageEnter.tsx),
// which looks the same and ships without the motion runtime. See patterns/README.md for sizes.

import { m } from "motion/react";
import type { ReactNode } from "react";

/*
 * Page enter transition for the Next.js App Router.
 * Use it from app/template.tsx (a template re-mounts on every navigation, a layout does not):
 *
 *   // app/template.tsx
 *   import { PageTransition } from "@/components/motion/PageTransition";
 *   export default function Template({ children }: { children: React.ReactNode }) {
 *     return <PageTransition>{children}</PageTransition>;
 *   }
 *
 * Enter only: 6px rise + fade, 220ms. Exit animations in the App Router need hacks around
 * the router's internals and are not worth the risk this week. Under reduced motion,
 * MotionConfig (see MotionProvider) drops the rise and keeps a short fade.
 *
 * From motionsites: route changes swap content instantly; the polish lives in the hero and
 * cards. A short enter keeps Brace feeling like one instrument when you move between pages.
 */

export function PageTransition({ children }: { children: ReactNode }) {
  return (
    <m.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}>
      {children}
    </m.div>
  );
}
