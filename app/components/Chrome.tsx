"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { PROGRAM_ID, REPO_URL, explorerAddress } from "@/lib/brace";

function ThemeToggle() {
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
      // Storage can be blocked (private mode); the toggle still works for this visit.
    }
    setTheme(next);
  };

  const label = theme === "dark" ? "Switch to light theme" : "Switch to dark theme";
  return (
    <button type="button" className="icon-btn" onClick={flip} aria-label={label} title={label}>
      {theme === "dark" ? <Sun size={16} strokeWidth={1.5} aria-hidden /> : <Moon size={16} strokeWidth={1.5} aria-hidden />}
    </button>
  );
}

const LINKS = [
  { href: "/", label: "Board" },
  { href: "/borrow", label: "Borrow" },
  { href: "/history", label: "History" },
  { href: "/about", label: "About" },
];

function isActive(path: string, href: string) {
  if (href === "/") return path === "/" || path.startsWith("/asset");
  return path === href;
}

function Menu({ path }: { path: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menu" ref={ref}>
      <button type="button" className="menu-btn" aria-expanded={open} aria-controls="site-menu" onClick={() => setOpen((o) => !o)}>
        Menu
      </button>
      {open && (
        <ul className="menu-list" id="site-menu">
          {LINKS.map((l) => (
            <li key={l.href}>
              <Link href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined}>
                {l.label}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Header() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand" aria-label="Brace, devnet, home">
          Brace <span className="net">devnet</span>
        </Link>
        <div className="nav-right">
          <nav className="nav-links" aria-label="Main">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(path, l.href) ? "page" : undefined}>
                {l.label}
              </Link>
            ))}
          </nav>
          <Menu path={path} />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>Devnet build for UBC 2026. Test funds only.</p>
        <div className="footer-links">
          <a className="text-link" href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub
          </a>
          <a className="text-link" href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">
            Program on Explorer
          </a>
        </div>
      </div>
    </footer>
  );
}
