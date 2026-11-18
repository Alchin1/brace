"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, Moon, Sun } from "lucide-react";
import { PROGRAM_ID, REPO_URL, explorerAddress, feedEffectiveLtvBps, feedStatus } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { RELAYER_URL } from "@/lib/history";
import { useBoard } from "./BoardProvider";
import { BraceMark } from "./ui/BraceMark";
import { CopyField } from "./ui/CopyField";
import { MiniBoard } from "./ui/MiniBoard";

type Theme = "light" | "dark";

function useTheme() {
  const [theme, setTheme] = useState<Theme | null>(null);
  useEffect(() => {
    const attr = document.documentElement.getAttribute("data-theme");
    if (attr === "light" || attr === "dark") setTheme(attr);
    else setTheme(window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
  }, []);
  const set = useCallback((next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("brace-theme", next);
    } catch {
      // Storage can be blocked (private mode); the switch still works for this visit.
    }
    setTheme(next);
  }, []);
  return [theme, set] as const;
}

/** Paper or night shift. Two radios; arrow keys move between them. */
function ThemeSwitch({ id }: { id: string }) {
  const [theme, set] = useTheme();
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
      e.preventDefault();
      set(theme === "dark" ? "light" : "dark");
    }
  };
  return (
    <div className="theme-sw" role="radiogroup" aria-label="Theme" id={id} onKeyDown={onKey}>
      <button type="button" role="radio" aria-checked={theme === "light"} tabIndex={theme === "dark" ? -1 : 0} onClick={() => set("light")} aria-label="Light theme">
        <Sun size={16} strokeWidth={1.5} aria-hidden />
      </button>
      <button type="button" role="radio" aria-checked={theme === "dark"} tabIndex={theme === "dark" ? 0 : -1} onClick={() => set("dark")} aria-label="Dark theme">
        <Moon size={16} strokeWidth={1.5} aria-hidden />
      </button>
    </div>
  );
}

const LINKS = [
  { href: "/", label: "Board", note: "Five live limits and the ladder behind them" },
  { href: "/borrow", label: "Borrow", note: "Borrow test USD against devnet SOL" },
  { href: "/history", label: "History", note: "24 hours of limits, blocks and borrows" },
  { href: "/about", label: "About", note: "How the oracle works, and its limits" },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/asset");
  return path === href;
}

/** SOL live limit in the header. Not a live region; the stage carries the announcement. */
function NavReading() {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok?.feeds.SOL ?? null;
  const status = ok ? feedStatus(f, ok.config.params, now) : null;
  const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
  return (
    <Link href="/asset/SOL" className="nav-reading" aria-label={`SOL live limit ${limit === null ? "not read yet" : pct1(limit)}`}>
      <span className={`dot ${status ?? "none"}`} aria-hidden />
      <span aria-hidden>SOL</span>
      <strong aria-hidden>{limit === null ? "--" : pct1(limit)}</strong>
    </Link>
  );
}

function MenuSheet({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const btn = useRef<HTMLButtonElement>(null);
  const sheet = useRef<HTMLDivElement>(null);

  const close = useCallback((refocus = true) => {
    setOpen(false);
    if (refocus) btn.current?.focus();
  }, []);

  useEffect(() => setOpen(false), [path]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = sheet.current?.querySelector<HTMLElement>("a, button");
    first?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
      if (e.key === "Tab" && sheet.current) {
        const f = Array.from(sheet.current.querySelectorAll<HTMLElement>("a[href], button:not([disabled])")).filter((el) => el.tabIndex !== -1);
        const all = [btn.current!, ...f];
        const i = all.indexOf(document.activeElement as HTMLElement);
        if (e.shiftKey && i <= 0) {
          e.preventDefault();
          all[all.length - 1].focus();
        } else if (!e.shiftKey && i === all.length - 1) {
          e.preventDefault();
          all[0].focus();
        }
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, close]);

  return (
    <div className="menu">
      <button
        ref={btn}
        type="button"
        className={`burger${open ? " is-open" : ""}`}
        aria-expanded={open}
        aria-controls="site-menu"
        aria-label={open ? "Close menu" : "Open menu"}
        onClick={() => setOpen((o) => !o)}
      >
        <span aria-hidden />
        <span aria-hidden />
      </button>
      <div ref={sheet} id="site-menu" className={`sheet${open ? " is-open" : ""}`} hidden={!open}>
        <div className="sheet-in">
          <nav aria-label="Menu">
            <ol className="sheet-links">
              {LINKS.map((l, i) => (
                <li key={l.href} style={{ ["--i" as string]: i }}>
                  <Link href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined} onClick={() => close(false)}>
                    <span className="sl-n">0{i + 1}</span>
                    <span className="sl-t">{l.label}</span>
                    <span className="sl-d">{l.note}</span>
                  </Link>
                </li>
              ))}
            </ol>
          </nav>
          <div className="sheet-board">
            <p className="sheet-k">Live limits</p>
            <MiniBoard onNavigate={() => close(false)} />
          </div>
          <div className="sheet-foot">
            <ThemeSwitch id="theme-menu" />
            <Link href="/borrow" className="btn btn-primary" onClick={() => close(false)}>
              Try a borrow <ArrowRight size={16} aria-hidden />
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}

export function Header() {
  const path = usePathname();
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <>
      <a href="#main" className="skip">
        Skip to content
      </a>
      <header className={`site-header${scrolled ? " is-scrolled" : ""}`}>
        <div className="wrap hd">
          <Link href="/" className="brand" aria-label="Brace, devnet, home">
            <BraceMark size={24} />
            <span className="brand-word">Brace</span>
            <span className="net">devnet</span>
          </Link>
          <nav className="nav-links" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <div className="nav-right">
            <NavReading />
            <span className="nav-theme">
              <ThemeSwitch id="theme-header" />
            </span>
            <MenuSheet path={path} />
          </div>
        </div>
      </header>
    </>
  );
}

export function Footer() {
  const id = PROGRAM_ID.toBase58();
  return (
    <footer className="site-footer">
      <div className="wrap ft">
        <div className="ft-brand">
          <Link href="/" className="brand" aria-label="Brace, home">
            <BraceMark size={24} />
            <span className="brand-word">Brace</span>
          </Link>
          <p>Lending limits from live prediction market odds. A devnet build for UBC 2026. Test funds only.</p>
        </div>
        <nav className="ft-links" aria-label="Footer">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href}>
              {l.label}
            </Link>
          ))}
          <a href={explorerAddress(id)} target="_blank" rel="noopener noreferrer">
            Explorer <ArrowUpRight size={14} aria-hidden />
          </a>
          <a href={`${RELAYER_URL}/health`} target="_blank" rel="noopener noreferrer">
            Relayer <ArrowUpRight size={14} aria-hidden />
          </a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub <ArrowUpRight size={14} aria-hidden />
          </a>
        </nav>
        <div className="ft-id">
          <CopyField label="Program id" value={id} display={`${id.slice(0, 8)}…${id.slice(-8)}`} />
          <p className="ft-built">Gemini prediction markets, Solana devnet, QuickNode Streams, Cloudflare Workers</p>
        </div>
      </div>
    </footer>
  );
}
