"use client";

import type { ReactNode } from "react";
import { useInViewOnce } from "./hooks";

/*
 * Section header with an index, a title, an optional aside, and a hairline that draws from
 * left to right the first time the section enters the viewport.
 *
 * This is Brace's "section transition". Motionsites templates separate sections with big
 * type changes, full-bleed media and pinned scroll scenes. For a finance tool a numbered,
 * ruled header carries the same rhythm (01 Live board, 02 How it works, ...) at no cost.
 * CSS only (one IntersectionObserver), no motion bundle needed.
 */

export function SectionHead({ index, title, id, aside }: { index: string; title: ReactNode; id: string; aside?: ReactNode }) {
  const [ref, seen] = useInViewOnce<HTMLDivElement>();
  return (
    <div ref={ref} className="rv-shead" data-seen={seen ? "" : undefined}>
      <span className="rv-shead-rule" aria-hidden />
      <div className="rv-shead-row">
        <span className="rv-eyebrow rv-shead-idx" aria-hidden>
          {index}
        </span>
        <h2 id={id} className="rv-h2">
          {title}
        </h2>
        {aside && <div className="rv-shead-aside">{aside}</div>}
      </div>
    </div>
  );
}
