"use client";

import { useEffect } from "react";

/** Marks the index link of the section being read, so the index tracks the scroll. */
export function AboutSpy({ ids }: { ids: string[] }) {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined") return;
    const links = new Map(ids.map((id) => [id, document.querySelector<HTMLAnchorElement>(`.about-index a[href="#${id}"]`)]));
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          links.forEach((a, id) => a?.toggleAttribute("data-on", id === e.target.id));
        }
      },
      { rootMargin: "-35% 0px -60% 0px" },
    );
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [ids]);
  return null;
}
