import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AssetDetail } from "@/components/AssetDetail";
import { SYMBOLS, isSymbol } from "@/lib/brace";

export const dynamicParams = false;

export function generateStaticParams() {
  return SYMBOLS.map((symbol) => ({ symbol }));
}

type Props = { params: Promise<{ symbol: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { symbol } = await params;
  return { title: `${symbol.toUpperCase()} feed` };
}

export default async function AssetPage({ params }: Props) {
  const { symbol } = await params;
  const s = symbol.toUpperCase();
  if (!isSymbol(s)) notFound();
  return <AssetDetail symbol={s} />;
}
