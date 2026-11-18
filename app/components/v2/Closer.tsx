"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import { ArrowRight } from "lucide-react";

const WORD = "6005";

/**
 * The closer: the program's refusal code set as one giant outlined word, read
 * through a violet viewfinder. On a mouse the window follows the pointer; on
 * touch, and before the pointer arrives, it sweeps the word on its own. Only
 * transforms move. Reduced motion parks the window over the code.
 */
export function Closer() {
  const box = useRef<HTMLDivElement>(null);
  const lens = useRef<HTMLSpanElement>(null);
  const fill = useRef<HTMLSpanElement>(null);
  const frame = useRef(0);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const size = () => {
      const r = el.getBoundingClientRect();
      const word = el.querySelector<HTMLElement>(".cl-out")?.getBoundingClientRect();
      const L = lens.current?.offsetWidth ?? 200;
      el.style.setProperty("--gw", `${r.width}px`);
      el.style.setProperty("--gh", `${r.height}px`);
      if (word) {
        const y = word.top - r.top + word.height / 2 - L / 2;
        el.style.setProperty("--ax", `${word.left - r.left - L * 0.2}px`);
        el.style.setProperty("--bx", `${word.right - r.left - L * 0.8}px`);
        el.style.setProperty("--ay", `${y}px`);
      }
    };
    size();
    const ro = new ResizeObserver(size);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const move = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !box.current || !lens.current || !fill.current) return;
    const r = box.current.getBoundingClientRect();
    const L = lens.current.offsetWidth;
    const x = e.clientX - r.left - L / 2;
    const y = e.clientY - r.top - L / 2;
    cancelAnimationFrame(frame.current);
    frame.current = requestAnimationFrame(() => {
      box.current!.classList.add("is-live");
      lens.current!.style.transform = `translate3d(${x}px,${y}px,0)`;
      fill.current!.style.transform = `translate3d(${-x}px,${-y}px,0)`;
    });
  };
  const leave = () => {
    cancelAnimationFrame(frame.current);
    box.current?.classList.remove("is-live");
    if (lens.current) lens.current.style.transform = "";
    if (fill.current) fill.current.style.transform = "";
  };

  return (
    <section className="closer ink" aria-labelledby="close-title" data-scene onPointerMove={move} onPointerLeave={leave}>
      <div className="wrap closer-grid">
        <div className="closer-in">
          <p className="shead-k">Error 6005, from the program</p>
          <h2 id="close-title">Now try to borrow past the line</h2>
          <p>Borrow over the live limit and the program refuses it onchain with error 6005, RiskTightened. It costs devnet SOL only.</p>
          <Link href="/borrow" className="btn btn-primary btn-lg">
            Try a borrow <ArrowRight size={18} aria-hidden />
          </Link>
        </div>
        <div className="cl-stage" ref={box} aria-hidden>
          <span className="cl-tag">RiskTightened</span>
          <span className="cl-out">{WORD}</span>
          <span className="cl-lens" ref={lens}>
            <span className="cl-fill" ref={fill}>
              <span className="cl-tag cl-ghost">RiskTightened</span>
              <span className="cl-out cl-in">{WORD}</span>
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}
