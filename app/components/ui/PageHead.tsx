import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { InstrumentField } from "./InstrumentField";

/** Top of an inner page: crumb, kicker, display title, lede, over a quiet grid. */
export function PageHead({ kicker, title, lede, crumb = true }: { kicker: string; title: React.ReactNode; lede?: React.ReactNode; crumb?: boolean }) {
  return (
    <header className="phead">
      <InstrumentField variant="quiet" />
      {crumb && (
        <Link href="/" className="crumb">
          <ArrowLeft size={16} aria-hidden /> All assets
        </Link>
      )}
      <p className="phead-k">{kicker}</p>
      <h1 className="display-2">{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}
