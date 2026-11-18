import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PreviewClient } from "./PreviewClient";

export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Development only. Renders the borrow states (connected, over the limit,
 * rejected, confirmed, sending) with a sample position so they can be
 * screenshotted without a wallet. In a production build this route is a 404,
 * and nothing links to it. It never touches the wallet or transaction code.
 */
export default async function DevPreview({ searchParams }: { searchParams: Promise<{ state?: string }> }) {
  if (process.env.NODE_ENV === "production") notFound();
  const { state } = await searchParams;
  return (
    <div className="page wrap borrow-page">
      <PreviewClient state={state ?? "connected"} />
    </div>
  );
}
