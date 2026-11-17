"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
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

  return (
    <button type="button" className="theme-btn" onClick={flip} aria-label="Toggle dark mode" aria-pressed={theme === "dark"}>
      {theme === "dark" ? "Light" : "Dark"}
    </button>
  );
}

const LINKS = [
  { href: "/", label: "Board", sm: true },
  { href: "/borrow", label: "Borrow", sm: false },
  { href: "/history", label: "History", sm: false },
  { href: "/about", label: "About", sm: true },
];

export function Header() {
  const path = usePathname();
  return (
    <header className="site-header">
      <div className="wrap">
        <Link href="/" className="brand">
          Brace <span className="tag">Solana devnet</span>
        </Link>
        <nav className="nav" aria-label="Main">
          {LINKS.map((l) => (
            <Link key={l.href} href={l.href} className={l.sm ? undefined : "hide-sm"} aria-current={path === l.href ? "page" : undefined}>
              {l.label}
            </Link>
          ))}
          <ThemeToggle />
        </nav>
      </div>
    </header>
  );
}

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="wrap">
        <p>Limits never exceed 75%, and odds never trigger a liquidation.</p>
        <div className="footer-links">
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer">
            GitHub repo
          </a>
          <a href={explorerAddress(PROGRAM_ID.toBase58())} target="_blank" rel="noopener noreferrer">
            Program on Solana Explorer
          </a>
        </div>
      </div>
    </footer>
  );
}
