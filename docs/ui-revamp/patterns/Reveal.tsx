"use client";

// OPTIONAL motion version. The default is the CSS version (RevealCss.tsx / PageEnter.tsx),
// which looks the same and ships without the motion runtime. See patterns/README.md for sizes.

import { m, type Variants } from "motion/react";
import type { ReactNode } from "react";

/*
 * Scroll reveal: fade plus a 12px rise, once, when 15% of the element is visible.
 * Motionsites uses the same idea as a CSS keyframe (parallax-fade-up, 0.6s ease-out, 16px).
 * Restrained defaults: 12px, 0.42s, no blur, no scale, no replay on scroll up.
 *
 * Never wrap live numbers, error notices or anything above the fold that a judge needs at
 * once: those must be visible on first paint. Reveal is for section bodies further down.
 */

const item: Variants = {
  hidden: { opacity: 0, y: 12 },
  shown: { opacity: 1, y: 0 },
};

type RevealProps = {
  children: ReactNode;
  className?: string;
  /** Seconds. Keep under 0.2 or the page feels slow. */
  delay?: number;
  as?: "div" | "section" | "li" | "article";
};

export function Reveal({ children, className, delay = 0, as = "div" }: RevealProps) {
  const Tag = m[as];
  return (
    <Tag
      className={className}
      variants={item}
      initial="hidden"
      whileInView="shown"
      viewport={{ once: true, amount: 0.15 }}
      transition={{ delay }}
    >
      {children}
    </Tag>
  );
}

const group: Variants = {
  hidden: {},
  shown: { transition: { staggerChildren: 0.06, delayChildren: 0.04 } },
};

/** Staggers its RevealItem children by 60ms. Cap a group at about 6 items. */
export function RevealGroup({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={group} initial="hidden" whileInView="shown" viewport={{ once: true, amount: 0.15 }}>
      {children}
    </Tag>
  );
}

export function RevealItem({ children, className, as = "div" }: { children: ReactNode; className?: string; as?: "div" | "li" | "article" }) {
  const Tag = m[as];
  return (
    <Tag className={className} variants={item}>
      {children}
    </Tag>
  );
}
