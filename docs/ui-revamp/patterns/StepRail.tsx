"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/*
 * "How it works" as a scroll story without scroll-jacking.
 *
 * From motionsites: 3D and "scroll" templates (Crystal Scroll, Shelf Hero) pin a scene and
 * swap content as you scroll. Brace keeps the idea, drops the pinning of the page: on desktop
 * a sticky left rail lists the steps and a progress line fills as each panel on the right
 * crosses the middle of the screen. On phones the rail hides and the panels stack with their
 * numbers. Native scroll throughout, so it works in Phantom's in-app browser.
 */

export type Step = { id: string; title: string; body: ReactNode; visual?: ReactNode };

export function StepRail({ steps, label }: { steps: Step[]; label: string }) {
  const [active, setActive] = useState(0);
  const panels = useRef<(HTMLElement | null)[]>([]);

  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            const i = panels.current.indexOf(e.target as HTMLElement);
            if (i >= 0) setActive(i);
          }
        }
      },
      { rootMargin: "-45% 0px -45% 0px" },
    );
    panels.current.forEach((p) => p && io.observe(p));
    return () => io.disconnect();
  }, [steps.length]);

  const progress = steps.length > 1 ? active / (steps.length - 1) : 1;

  return (
    <div className="rv-steps">
      <nav className="rv-steps-rail" aria-label={label}>
        <span className="rv-steps-track" aria-hidden>
          <span className="rv-steps-fill" style={{ transform: `scaleY(${progress})` }} />
        </span>
        <ol>
          {steps.map((s, i) => (
            <li key={s.id}>
              <a href={`#${s.id}`} aria-current={i === active ? "step" : undefined}>
                <span className="rv-steps-n">{String(i + 1).padStart(2, "0")}</span>
                {s.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>
      <div className="rv-steps-panels">
        {steps.map((s, i) => (
          <article
            key={s.id}
            id={s.id}
            ref={(el) => {
              panels.current[i] = el;
            }}
            className="rv-steps-panel"
            data-active={i === active ? "" : undefined}
          >
            <span className="rv-eyebrow">{String(i + 1).padStart(2, "0")}</span>
            <h3>{s.title}</h3>
            <div className="rv-steps-body">{s.body}</div>
            {s.visual && <div className="rv-steps-visual">{s.visual}</div>}
          </article>
        ))}
      </div>
    </div>
  );
}
