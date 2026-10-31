import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeftIcon } from "lucide-react";
import { PolicyDetails } from "@/components/home/policy-sheet";
import { loadCatalog, loadShortLinks } from "@/lib/data";
import { lawPath, shareUrl } from "@/lib/share";

type Props = { params: Promise<{ id: string }> };

// Static export: one page per law, built ahead of time. Unknown ids are 404s.
export const dynamicParams = false;

export async function generateStaticParams() {
  const { policies } = await loadCatalog();
  return policies.map((p) => ({ id: p.id }));
}

async function find(id: string) {
  const { policies } = await loadCatalog();
  return policies.find((p) => p.id === decodeURIComponent(id));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await find((await params).id);
  if (!p) return {};
  const title = `${p.title} (${p.year})`;
  // The share image itself comes from ./opengraph-image.tsx, which Next adds to og:image and twitter:image.
  return {
    title: `${title} · Lei Aberta`,
    description: p.summary,
    alternates: { canonical: lawPath(p.id) },
    openGraph: { type: "article", siteName: "Lei Aberta", locale: "pt_BR", title, description: p.summary, url: lawPath(p.id) },
    twitter: { card: "summary_large_image", title, description: p.summary },
  };
}

export default async function LawPage({ params }: Props) {
  const p = await find((await params).id);
  if (!p) notFound();
  const links = await loadShortLinks();
  return (
    <main className="mx-auto flex max-w-[620px] flex-col gap-3.5 px-[max(16px,env(safe-area-inset-left))] py-5">
      <Link href="/" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-semibold">
        <ArrowLeftIcon className="size-4" /> Ver todas as leis
      </Link>
      <PolicyDetails p={{ ...p, shareUrl: shareUrl(p.id, links) }} />
    </main>
  );
}
