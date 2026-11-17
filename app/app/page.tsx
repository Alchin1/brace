import Link from "next/link";
import { Board } from "@/components/Board";

export default function Home() {
  return (
    <>
      <h1>Risk board</h1>
      <p className="lede">Borrowing limits set every minute from Gemini prediction-market odds, computed onchain.</p>
      <Board />
      <div className="actions">
        <Link href="/borrow" className="btn btn-primary">
          Try a borrow
        </Link>
        <Link href="/history" className="btn">
          View history
        </Link>
      </div>
    </>
  );
}
