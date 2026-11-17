"use client";

import { Children, cloneElement, isValidElement, useEffect, useState, type CSSProperties, type ReactElement, type ReactNode } from "react";
import { useInViewOnce } from "./hooks";

/*
 * DEFAULT scroll reveal: same look as Reveal.tsx (fade + 12px rise, 420ms, once), built on one
 * IntersectionObserver and a CSS transition. Ships about 1 KB instead of the motion runtime
 * (check/check.sh measures both).
 *
 * Safe by construction: server HTML is fully visible. Elements are only hidden after
 * hydration ("armed") and only if they are still below the fold, so a script failure or a
 * slow phone never leaves a section blank.
 *
 * Never wrap live numbers, notices or anything a judge needs at first glance.
 */

function useArmed() {
  const [armed, setArmed] = useState(false);
  useEffect(() => setArmed(true), []);
  return armed;
}

export function Reveal({ children, className, delayMs = 0 }: { children: ReactNode; className?: string; delayMs?: number }) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  const armed = useArmed();
  return (
    <div
      ref={ref}
      className={`rv-reveal ${className ?? ""}`}
      data-armed={armed ? "" : undefined}
      data-seen={seen ? "" : undefined}
      style={{ "--rv-delay": `${delayMs}ms` } as CSSProperties}
    >
      {children}
    </div>
  );
}

/**
 * Staggers direct children by 60ms (capped at 6 steps). Children should be elements that
 * accept className and style, e.g. <div> or <li>.
 */
export function RevealGroup({ children, className, as: Tag = "div" }: { children: ReactNode; className?: string; as?: "div" | "ul" | "ol" }) {
  const [ref, seen] = useInViewOnce<HTMLElement>();
  const armed = useArmed();
  let i = 0;
  const kids = Children.map(children, (child) => {
    if (!isValidElement(child)) return child;
    const el = child as ReactElement<{ className?: string; style?: CSSProperties }>;
    const n = Math.min(i++, 6);
    return cloneElement(el, {
      className: `rv-reveal-item ${el.props.className ?? ""}`,
      style: { ...el.props.style, "--rv-delay": `${40 + n * 60}ms` } as CSSProperties,
    });
  });
  return (
    <Tag
      ref={ref as never}
      className={`rv-reveal-group ${className ?? ""}`}
      data-armed={armed ? "" : undefined}
      data-seen={seen ? "" : undefined}
    >
      {kids}
    </Tag>
  );
}
