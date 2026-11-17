"use client";

import { useState, type ElementType, type ReactNode } from "react";

/*
 * Footer with link columns, the program id with a copy button, a live status line, and an
 * oversized wordmark.
 *
 * From motionsites: their own footer is one quiet line (copyright, legal links, two social
 * icons). The fintech templates end on large wordmarks and column grids. Brace takes the
 * column grid and the wordmark, and adds what a judge wants: the program id, Explorer and
 * GitHub, and whether the relayer is live right now (from /health, real data only).
 */

export type FooterColumn = { title: string; links: { href: string; label: string; external?: boolean }[] };

type Props = {
  columns: FooterColumn[];
  programId: string;
  explorerUrl: string;
  /** e.g. <><span className="rv-dot" data-status="live" /> Relayer live, last post 12s ago</> */
  status?: ReactNode;
  note: ReactNode;
  wordmark?: string;
  linkAs?: ElementType;
};

export function SiteFooter({ columns, programId, explorerUrl, status, note, wordmark = "Brace", linkAs: L = "a" }: Props) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(programId);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked (http, in-app browsers). The id stays selectable as text.
    }
  };
  return (
    <footer className="rv-footer">
      <div className="rv-wrap">
        <div className="rv-footer-top">
          <div className="rv-footer-id">
            <p className="rv-eyebrow">Program on Solana devnet</p>
            <p className="rv-footer-pid">
              <a href={explorerUrl} target="_blank" rel="noopener noreferrer" className="rv-footer-pid-link">
                {programId}
              </a>
            </p>
            <div className="rv-footer-id-actions">
              <button type="button" className="rv-btn rv-btn-ghost rv-footer-copy" onClick={copy}>
                {copied ? "Copied" : "Copy program id"}
              </button>
              <span className="rv-sr-only" aria-live="polite">
                {copied ? "Program id copied" : ""}
              </span>
            </div>
            {status && <p className="rv-footer-status">{status}</p>}
          </div>
          {columns.map((c) => (
            <nav key={c.title} className="rv-footer-col" aria-label={c.title}>
              <p className="rv-footer-col-title">{c.title}</p>
              <ul>
                {c.links.map((l) =>
                  l.external ? (
                    <li key={l.href}>
                      <a href={l.href} target="_blank" rel="noopener noreferrer">
                        {l.label}
                      </a>
                    </li>
                  ) : (
                    <li key={l.href}>
                      <L href={l.href}>{l.label}</L>
                    </li>
                  ),
                )}
              </ul>
            </nav>
          ))}
        </div>
        <div className="rv-footer-bottom">
          <p>{note}</p>
        </div>
        <p className="rv-footer-wordmark" aria-hidden>
          {wordmark}
        </p>
      </div>
    </footer>
  );
}
