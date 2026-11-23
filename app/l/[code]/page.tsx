import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { policyIds } from "@/lib/data";
import { assertUniqueCodes, lawPath } from "@/lib/share";
import { findLaw, lawMetadata, LawView } from "../../lei/law";

/**
 * Short link for a law: /l/<code>. It shows the law itself instead of redirecting, so that
 * link previews work everywhere and Vercel Web Analytics counts each visit as a /l/* page view.
 * Its canonical URL is the full page, /lei/<id>.
 */
type Props = { params: Promise<{ code: string }> };

// Rendered on request and cached on the CDN, like the law pages (see lib/cdn-cache.ts).
export const dynamic = "force-dynamic";

// Every short code, hashed once per server instance rather than on every request.
let byCode: Promise<Map<string, string>> | undefined;
function codes() {
  return (byCode ??= policyIds().then(assertUniqueCodes));
}

async function lawFor(code: string) {
  const id = (await codes()).get(code);
  return id ? findLaw(id) : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const p = await lawFor((await params).code);
  return p ? lawMetadata(p, `${lawPath(p.id)}/opengraph-image`) : {};
}

export default async function ShortLinkPage({ params }: Props) {
  const p = await lawFor((await params).code);
  if (!p) notFound();
  return <LawView p={p} />;
}
