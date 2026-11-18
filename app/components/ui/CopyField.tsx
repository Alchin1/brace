"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

/** A read-only value with a copy button. Announces "Copied" once, politely. */
export function CopyField({ value, label, display }: { value: string; label: string; display?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be blocked in some in-app browsers; the value stays selectable.
    }
  };
  return (
    <div className="copyf">
      <span className="copyf-label">{label}</span>
      <code className="copyf-v" title={value}>
        {display ?? value}
      </code>
      <button type="button" className="copyf-btn" onClick={copy} aria-label={`Copy ${label}`}>
        {copied ? <Check size={16} aria-hidden /> : <Copy size={16} aria-hidden />}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {copied ? "Copied" : ""}
      </span>
    </div>
  );
}
