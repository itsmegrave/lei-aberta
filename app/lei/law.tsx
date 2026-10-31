import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { PolicyDetails } from "@/components/home/policy-sheet";
import { JsonLd } from "@/components/seo/json-ld";
import { SiteFooter } from "@/components/site-footer";
import { SiteNav } from "@/components/site-nav";
import { SEARCH_PATH } from "@/lib/listing";
import { findPolicy } from "@/lib/data";
import { lawPath, shortUrl } from "@/lib/share";
import { lawDescription, lawJsonLd, lawTitle, SITE_NAME } from "@/lib/seo";
import type { Policy } from "@/lib/types";

/** Shared by the law page (/lei/<id>) and its short link (/l/<code>). */
export async function findLaw(id: string) {
  return findPolicy(id);
}

/** Metadata for link previews. `image` is set on the short link page, which has no image of its own. */
export function lawMetadata(p: Policy, image?: string): Metadata {
  // "%s · Lei Aberta" comes from the layout's title template.
  const title = lawTitle(p);
  const description = lawDescription(p);
  const images = image ? [{ url: image, width: 1200, height: 630, alt: "Resumo da lei no Lei Aberta" }] : undefined;
  return {
    title,
    description,
    // The short link page points search engines at the full page.
    alternates: { canonical: lawPath(p.id) },
    openGraph: { type: "article", siteName: SITE_NAME, locale: "pt_BR", title, description, url: lawPath(p.id), ...(images && { images }) },
    twitter: { card: "summary_large_image", title, description, ...(images && { images }) },
  };
}

export function LawView({ p }: { p: Policy }) {
  return (
    <div className="mx-auto max-w-[1120px] px-[max(16px,env(safe-area-inset-left))] pb-7">
      <SiteNav />
      <main id="conteudo" tabIndex={-1} className="mx-auto flex max-w-[620px] flex-col gap-3.5 pb-5 outline-none">
        <Link href={SEARCH_PATH} className="text-muted-foreground hover:text-foreground flex w-fit items-center gap-1.5 py-1 text-sm font-semibold">
          <ArrowLeftIcon className="size-4" aria-hidden /> Ver todas as leis
        </Link>
        <JsonLd data={lawJsonLd(p)} />
        <PolicyDetails p={{ ...p, shareUrl: shortUrl(p.id) }} />
      </main>
      <SiteFooter />
    </div>
  );
}
