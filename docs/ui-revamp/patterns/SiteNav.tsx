"use client";

import { useEffect, useId, useRef, useState, type ElementType, type ReactNode } from "react";
import { useScrolled } from "./hooks";

/*
 * Sticky header + mobile menu sheet.
 *
 * From motionsites: the top bar floats over the hero, then settles; the mobile menu is a
 * compact panel under the bar with large, well spaced links. Their bar is a dark pill
 * (rounded-full, height 48, soft shadow). Brace keeps square-ish 10px corners and a hairline
 * instead of a shadow, and turns the bar solid (with a light blur) only after you scroll.
 *
 * Accessibility: real <nav>, aria-current on the active link, menu button with
 * aria-expanded/aria-controls, Escape and outside click close it, focus moves into the sheet
 * and back to the button, page scroll is locked while the sheet is open, 44px targets.
 *
 * Pass Next's Link as `linkAs` in the app: <SiteNav linkAs={Link} ... />.
 * CSS only (enter keyframes live in reveal.css); no motion runtime needed.
 */

export type NavLink = { href: string; label: string };

type Props = {
  links: NavLink[];
  /** Current pathname, from usePathname() in the app. */
  path: string;
  isActive?: (path: string, href: string) => boolean;
  brand: ReactNode;
  /** Right side extras, e.g. <ThemeToggle />. */
  right?: ReactNode;
  linkAs?: ElementType;
};

const defaultActive = (path: string, href: string) => (href === "/" ? path === "/" : path === href || path.startsWith(href + "/"));

export function SiteNav({ links, path, isActive = defaultActive, brand, right, linkAs: L = "a" }: Props) {
  const scrolled = useScrolled(8);
  const [open, setOpen] = useState(false);
  const sheetId = useId();
  const btnRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);

  // Close on navigation.
  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = sheetRef.current?.querySelector<HTMLElement>("a,button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        btnRef.current?.focus();
      }
    };
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!sheetRef.current?.contains(t) && !btnRef.current?.contains(t)) setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("pointerdown", onDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("pointerdown", onDown);
    };
  }, [open]);

  return (
    <header className="rv-nav" data-scrolled={scrolled || open ? "" : undefined}>
      <div className="rv-nav-bar rv-wrap">
        <div className="rv-nav-brand">{brand}</div>
        <nav className="rv-nav-links" aria-label="Main">
          {links.map((l) => {
            const active = isActive(path, l.href);
            return (
              <L key={l.href} href={l.href} className="rv-nav-link" aria-current={active ? "page" : undefined}>
                {l.label}
                {active && <span className="rv-nav-underline" aria-hidden />}
              </L>
            );
          })}
        </nav>
        <div className="rv-nav-right">
          {right}
          <button
            ref={btnRef}
            type="button"
            className="rv-nav-menu-btn"
            aria-expanded={open}
            aria-controls={sheetId}
            onClick={() => setOpen((o) => !o)}
          >
            <span className="rv-burger" data-open={open ? "" : undefined} aria-hidden>
              <span />
              <span />
            </span>
            {open ? "Close" : "Menu"}
          </button>
        </div>
      </div>

      {open && (
        <div ref={sheetRef} id={sheetId} className="rv-nav-sheet">
          <nav aria-label="Main">
            <ol className="rv-nav-sheet-list">
              {links.map((l, i) => (
                <li key={l.href}>
                  <L href={l.href} className="rv-nav-sheet-link" aria-current={isActive(path, l.href) ? "page" : undefined}>
                    <span className="rv-nav-sheet-idx" aria-hidden>
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    {l.label}
                  </L>
                </li>
              ))}
            </ol>
          </nav>
        </div>
      )}
    </header>
  );
}

/** Same behaviour as the current app's toggle (localStorage key "brace-theme"), restyled. */
export function ThemeToggle({ sun, moon }: { sun: ReactNode; moon: ReactNode }) {
  const [theme, setTheme] = useState<"light" | "dark" | null>(null);
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") setTheme(attr);
    else setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  const flip = () => {
    const next = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("brace-theme", next);
    } catch {
      // Private mode can block storage; the toggle still works for this visit.
    }
    setTheme(next);
  };
  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" className="rv-icon-btn" onClick={flip} aria-label={label} title={label}>
      {theme === "dark" ? sun : moon}
    </button>
  );
}
