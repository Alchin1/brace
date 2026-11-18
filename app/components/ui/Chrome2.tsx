"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowRight } from "lucide-react";
import { feedEffectiveLtvBps, feedStatus } from "@/lib/brace";
import { pct1 } from "@/lib/chart";
import { useBoard } from "../BoardProvider";
import { LimitRing } from "./Meters";
import { RollingNumber } from "./RollingNumber";

/** SOL live limit as a small header chip. Not a live region. */
export function NavReading() {
  const { state, now } = useBoard();
  const ok = state?.kind === "ok" ? state : null;
  const f = ok?.feeds.SOL ?? null;
  const status = ok ? feedStatus(f, ok.config.params, now) : null;
  const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
  return (
    <Link href="/asset/SOL" className="nav-reading" aria-label={`SOL live limit ${limit === null ? "not read yet" : pct1(limit)}`}>
      <span className={`dot ${status ?? "none"}`} aria-hidden />
      <span className="nr-k" aria-hidden>
        SOL limit
      </span>
      <span className="nr-v" aria-hidden>
        {limit === null ? "--" : <RollingNumber value={pct1(limit)} />}
      </span>
    </Link>
  );
}

/** A thin reading-progress line under the header. Decorative. */
export function ScrollProgress() {
  return <div className="scroll-progress" aria-hidden />;
}

/**
 * Phone-only bar with the live SOL limit and Try a borrow. Appears once the
 * page is scrolled past the first screen; never on /borrow.
 */
export function StickyBar() {
  const path = usePathname();
  const { state, now } = useBoard();
  const [show, setShow] = useState(false);
  const ok = state?.kind === "ok" ? state : null;
  const f = ok?.feeds.SOL ?? null;
  const limit = ok && f ? feedEffectiveLtvBps(f, ok.config.params, now) : null;
  const cap = ok?.config.params.govMaxLtvBps ?? 7500;
  const liq = ok?.config.params.liqThresholdBps ?? 8000;

  useEffect(() => {
    let frame = 0;
    const on = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        setShow(window.scrollY > window.innerHeight * 0.75);
      });
    };
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => {
      window.removeEventListener("scroll", on);
      cancelAnimationFrame(frame);
    };
  }, [path]);

  if (path === "/borrow" || path.startsWith("/dev-preview")) return null;
  return (
    <div className={`stickybar${show ? " is-shown" : ""}`} aria-hidden={!show} inert={!show ? true : undefined}>
      <div className="stickybar-in">
        <LimitRing limitBps={limit} capBps={cap} liqBps={liq} size={44} center={<span />} label="SOL live limit" />
        <div className="stickybar-read">
          <span className="sb-k">SOL live limit</span>
          <span className="sb-v">{limit === null ? "--" : <RollingNumber value={pct1(limit)} />}</span>
        </div>
        <Link href="/borrow" className="btn btn-primary sb-btn">
          Try a borrow <ArrowRight size={16} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
