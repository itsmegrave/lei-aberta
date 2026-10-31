import { jsonLdString } from "@/lib/seo";

/** schema.org structured data, rendered into the static HTML for search engines. */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: jsonLdString(data) }} />;
}
