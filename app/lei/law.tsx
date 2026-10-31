import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PolicyDetails } from "@/components/home/policy-sheet";
import { loadCatalog } from "@/lib/data";
import { lawPath, shortUrl } from "@/lib/share";
import type { Policy } from "@/lib/types";

/** Shared by the law page (/lei/<id>) and its short link (/l/<code>). */
export async function findLaw(id: string) {
  const { policies } = await loadCatalog();
  return policies.find((p) => p.id === id);
}

/** Metadata for link previews. `image` is set on the short link page, which has no image of its own. */
export function lawMetadata(p: Policy, image?: string): Metadata {
  const title = `${p.title} (${p.year})`;
  const images = image ? [{ url: image, width: 1200, height: 630, alt: "Resumo da lei no Lei Aberta" }] : undefined;
  return {
    title: `${title} · Lei Aberta`,
    description: p.summary,
    // The short link page points search engines at the full page.
    alternates: { canonical: lawPath(p.id) },
    openGraph: { type: "article", siteName: "Lei Aberta", locale: "pt_BR", title, description: p.summary, url: lawPath(p.id), ...(images && { images }) },
    twitter: { card: "summary_large_image", title, description: p.summary, ...(images && { images }) },
  };
}

export function LawView({ p }: { p: Policy }) {
  return (
    <main className="mx-auto flex max-w-[620px] flex-col gap-3.5 px-[max(16px,env(safe-area-inset-left))] py-5">
      <Link href="/" className="text-muted-foreground hover:text-foreground flex items-center gap-1.5 text-sm font-semibold">
        <ArrowLeftIcon className="size-4" /> Ver todas as leis
      </Link>
      <PolicyDetails p={{ ...p, shareUrl: shortUrl(p.id) }} />
    </main>
  );
}
