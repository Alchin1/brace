import { RevealOnScroll } from "@/components/ui/Reveal";

/** Remounts on every route change: a short page enter and the one-time scroll reveals. */
export default function Template({ children }: { children: React.ReactNode }) {
  return (
    <div className="page-enter">
      {children}
      <RevealOnScroll />
    </div>
  );
}
