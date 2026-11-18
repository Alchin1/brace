import Link from "next/link";
import { ArrowLeft } from "lucide-react";

/** Top of an inner page: crumb, a mono kicker on a ruled line, the title, a lede. */
export function PageHead({ kicker, title, lede, crumb = true }: { kicker: string; title: React.ReactNode; lede?: React.ReactNode; crumb?: boolean }) {
  return (
    <header className="phead">
      {crumb && (
        <Link href="/" className="crumb">
          <ArrowLeft size={16} aria-hidden /> Board
        </Link>
      )}
      <p className="phead-k">{kicker}</p>
      <h1 className="display-2">{title}</h1>
      {lede && <p className="lede">{lede}</p>}
    </header>
  );
}
