import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { findLaw, lawMetadata, LawView } from "../law";

type Props = { params: Promise<{ id: string }> };

// One page per law, rendered on first request and then cached (see next.config.ts).
// Prerendering all of them made the build run past Vercel's time limit.
export const dynamicParams = true;
export const revalidate = false;

export async function generateStaticParams() {
  return [];
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
