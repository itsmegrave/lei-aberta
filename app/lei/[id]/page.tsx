import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { loadCatalog } from "@/lib/data";
import { findLaw, lawMetadata, LawView } from "../law";

type Props = { params: Promise<{ id: string }> };

// Static export: one page per law, built ahead of time. Unknown ids are 404s.
export const dynamicParams = false;

export async function generateStaticParams() {
  const { policies } = await loadCatalog();
  return policies.map((p) => ({ id: p.id }));
}

// The share image comes from ./opengraph-image.tsx, which Next adds to og:image and twitter:image.
export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await findLaw(decodeURIComponent((await params).id));
  return p ? lawMetadata(p) : {};
}

export default async function LawPage({ params }: Props) {
  const p = await findLaw(decodeURIComponent((await params).id));
  if (!p) notFound();
  return <LawView p={p} />;
}
