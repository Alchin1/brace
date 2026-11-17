import type { ReactNode } from "react";

/*
 * Closing call to action before the footer.
 * From motionsites: big centred statement + one button on a dark, lit band (e.g. "Vexor CTA":
 * a smoky gradient video behind "Get your Vexor Account"). Brace: the same hierarchy on a
 * raised panel with the hero grid, one primary button, one quiet link. No video, no glow.
 */

export function CtaBand({ title, body, actions, id = "cta-title" }: { title: ReactNode; body?: ReactNode; actions: ReactNode; id?: string }) {
  return (
    <section className="rv-cta" aria-labelledby={id}>
      <div className="rv-cta-panel">
        <h2 id={id} className="rv-h2">
          {title}
        </h2>
        {body && <p className="rv-cta-body">{body}</p>}
        <div className="rv-cta-actions">{actions}</div>
      </div>
    </section>
  );
}
