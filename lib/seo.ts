import type { Policy } from "./types";
import { partyPath, PARTIES_PATH, tseUrl, type Party } from "./parties.ts";
import { lawPath, SITE_URL } from "./share.ts";
import { area, lawLabel, LEVELS, typeLabel } from "./vocab.ts";

// Search metadata (titles, descriptions, sitemaps, schema.org JSON-LD). Text is pt-BR, for the general public.

export const SITE_NAME = "Lei Aberta";
export const SITE_TITLE = "Lei Aberta: as leis do Brasil explicadas em uma frase";
export const SITE_DESCRIPTION =
  "Leis federais, estaduais e municipais do Brasil desde 1988, cada uma em uma frase, com quem propôs, quem sancionou e o link para o texto oficial.";
/** Search engines cut descriptions around 155-160 characters. */
const MAX_DESCRIPTION = 158;

/** Google accepts up to 50,000 URLs per sitemap file; stay well under it so each file stays small. */
export const SITEMAP_CHUNK = 10_000;

const abs = (p: string, base = SITE_URL) => `${base}${p}`;

/** "Lei 13.709/2018" when the record has a number, otherwise "Lei de 2018". */
export function lawRef(p: Pick<Policy, "type" | "number" | "year">): string {
  return p.number ? `${lawLabel(p, true)}/${p.year}` : `${typeLabel(p.type, true)} de ${p.year}`;
}

/** Page title for a law, before the " · Lei Aberta" suffix from the layout's title template. */
export function lawTitle(p: Pick<Policy, "title" | "type" | "number" | "year">): string {
  const ref = lawRef(p);
  // Some titles already are the reference ("Lei 8.069/1990"); don't repeat it.
  return p.title.includes(ref) ? p.title : `${p.title}: ${ref}`;
}

/** Meta description: the one-line summary, plus what the page offers when there is room. */
export function lawDescription(p: Pick<Policy, "summary" | "level" | "jurisdiction">): string {
  const summary = p.summary.trim().replace(/\s+/g, " ");
  const withDot = /[.!?…]$/.test(summary) ? summary : `${summary}.`;
  const where = p.level === "federal" ? "Lei federal" : `Lei ${LEVELS.find((l) => l.key === p.level)?.label.toLowerCase() ?? ""} (${p.jurisdiction})`;
  const extra = ` ${where}: veja quem propôs, quem sancionou e o texto oficial.`;
  if (withDot.length + extra.length <= MAX_DESCRIPTION) return withDot + extra;
  if (withDot.length <= MAX_DESCRIPTION) return withDot;
  return `${withDot.slice(0, MAX_DESCRIPTION - 1).replace(/\s+\S*$/, "")}…`;
}

/** Splits the law ids into sitemap files of at most `size` URLs, in a stable order. */
export function sitemapChunks<T extends { id: string }>(items: T[], size = SITEMAP_CHUNK): T[][] {
  const sorted = [...items].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const out: T[][] = [];
  for (let i = 0; i < sorted.length; i += size) out.push(sorted.slice(i, i + size));
  return out;
}

const xmlEscape = (s: string) => s.replace(/[<>&'"]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;", "'": "&apos;", '"': "&quot;" })[c]!);

export function sitemapIndexXml(files: string[], lastmod: string, base = SITE_URL): string {
  const rows = files.map((f) => `  <sitemap><loc>${xmlEscape(abs(f, base))}</loc><lastmod>${lastmod}</lastmod></sitemap>`);
  return `<?xml version="1.0" encoding="UTF-8"?>\n<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</sitemapindex>\n`;
}

export interface SitemapUrl {
  path: string;
  lastmod: string;
  /** Optional image (the law's share image) for Google Images. */
  image?: string;
}

export function urlsetXml(urls: SitemapUrl[], base = SITE_URL): string {
  const rows = urls.map((u) => {
    const img = u.image ? `<image:image><image:loc>${xmlEscape(abs(u.image, base))}</image:loc></image:image>` : "";
    return `  <url><loc>${xmlEscape(abs(u.path, base))}</loc><lastmod>${u.lastmod}</lastmod>${img}</url>`;
  });
  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n` +
    `${rows.join("\n")}\n</urlset>\n`
  );
}

type JsonLd = Record<string, unknown>;

const ORG_ID = (base: string) => `${base}/#organizacao`;
const SITE_ID = (base: string) => `${base}/#site`;

/** Home page graph: the site (with its search box) and the project behind it. */
export function siteJsonLd(base = SITE_URL): JsonLd {
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": ORG_ID(base),
        name: SITE_NAME,
        url: `${base}/`,
        logo: `${base}/icon.png`,
        sameAs: ["https://github.com/itsmegrave/lei-aberta"],
      },
      {
        "@type": "WebSite",
        "@id": SITE_ID(base),
        name: SITE_NAME,
        alternateName: "Lei Aberta Brasil",
        url: `${base}/`,
        description: SITE_DESCRIPTION,
        inLanguage: "pt-BR",
        publisher: { "@id": ORG_ID(base) },
        potentialAction: {
          "@type": "SearchAction",
          target: { "@type": "EntryPoint", urlTemplate: `${base}/busca?q={search_term_string}` },
          "query-input": "required name=search_term_string",
        },
      },
    ],
  };
}

// Only statuses that settle the question. "Sancionada" says it was signed, not that it is still in force today.
const LEGAL_FORCE: Record<string, string> = {
  revogada: "https://schema.org/NotInForce",
  "perdeu-eficacia": "https://schema.org/NotInForce",
  rejeitada: "https://schema.org/NotInForce",
};

/** A law page: schema.org Legislation (with the official text as a sameAs link) and its breadcrumb. */
export function lawJsonLd(p: Policy, base = SITE_URL): JsonLd {
  const url = abs(lawPath(p.id), base);
  const legislation: JsonLd = {
    "@type": "Legislation",
    "@id": `${url}#lei`,
    url,
    name: p.title,
    alternateName: p.number ? lawRef(p) : undefined,
    abstract: p.summary,
    legislationIdentifier: p.number ? lawRef(p) : undefined,
    legislationType: typeLabel(p.type, true),
    legislationDate: p.signedAt ?? undefined,
    datePublished: p.signedAt ?? String(p.year),
    legislationJurisdiction: p.jurisdiction,
    legislationLegalForce: LEGAL_FORCE[p.status],
    inLanguage: "pt-BR",
    keywords: p.areas.map((a) => area(a).label).join(", ") || undefined,
    author: p.authors
      .filter((a) => a.kind !== "executive")
      .map((a) => ({ "@type": "Person", name: a.name, ...(a.party ? { affiliation: { "@type": "PoliticalParty", name: a.party } } : {}) })),
    sameAs: p.sources.map((s) => s.url),
    image: `${url}/opengraph-image`,
    isPartOf: { "@id": SITE_ID(base) },
  };
  const breadcrumb: JsonLd = {
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${base}/` },
      { "@type": "ListItem", position: 2, name: p.title, item: url },
    ],
  };
  return { "@context": "https://schema.org", "@graph": [prune(legislation), breadcrumb] };
}

export const PARTIES_TITLE = "Partidos políticos do Brasil: história e leis de cada um";
export const PARTIES_DESCRIPTION =
  "Os partidos registrados no TSE, com a história de cada um (fundação, fusões e mudanças de nome), o site oficial e as leis que propuseram ou sancionaram.";

/** "MDB: Movimento Democrático Brasileiro", or just the name when it is the short name too. */
export function partyTitle(p: Pick<Party, "short" | "name">): string {
  return p.short === p.name ? `${p.name}: história e leis do partido` : `${p.short}: ${p.name}`;
}

export function partyDescription(p: Pick<Party, "short" | "name" | "number" | "about">, counts: { proposed: number; signed: number }): string {
  const nums = `No catálogo: ${counts.proposed} ${counts.proposed === 1 ? "lei proposta" : "leis propostas"} e ${counts.signed} ${counts.signed === 1 ? "sancionada" : "sancionadas"}.`;
  const lead = `${p.name} (${p.short}), número ${p.number}. ${p.about}`;
  const full = `${lead} ${nums}`;
  if (full.length <= MAX_DESCRIPTION) return full;
  if (lead.length <= MAX_DESCRIPTION) return lead;
  return `${lead.slice(0, MAX_DESCRIPTION - 1).replace(/\s+\S*$/, "")}…`;
}

/** A party page: schema.org PoliticalParty with only registry facts, and its breadcrumb. */
export function partyJsonLd(p: Party, base = SITE_URL): JsonLd {
  const url = abs(partyPath(p.slug), base);
  return {
    "@context": "https://schema.org",
    "@graph": [
      prune({
        "@type": "PoliticalParty",
        "@id": `${url}#partido`,
        name: p.name,
        alternateName: p.short !== p.name ? p.short : undefined,
        url: p.website ?? undefined,
        description: p.about,
        sameAs: [p.website, tseUrl(p)].filter(Boolean),
        subjectOf: { "@id": `${url}#pagina` },
      }),
      { "@type": "WebPage", "@id": `${url}#pagina`, url, name: partyTitle(p), inLanguage: "pt-BR", isPartOf: { "@id": SITE_ID(base) } },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${base}/` },
          { "@type": "ListItem", position: 2, name: "Partidos", item: abs(PARTIES_PATH, base) },
          { "@type": "ListItem", position: 3, name: p.short, item: url },
        ],
      },
    ],
  };
}

/** The directory page: a list of the party pages. */
export function partiesJsonLd(parties: Pick<Party, "slug" | "name">[], base = SITE_URL): JsonLd {
  const url = abs(PARTIES_PATH, base);
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "CollectionPage",
        "@id": `${url}#pagina`,
        url,
        name: PARTIES_TITLE,
        description: PARTIES_DESCRIPTION,
        inLanguage: "pt-BR",
        isPartOf: { "@id": SITE_ID(base) },
        mainEntity: {
          "@type": "ItemList",
          itemListElement: parties.map((p, i) => ({ "@type": "ListItem", position: i + 1, name: p.name, url: abs(partyPath(p.slug), base) })),
        },
      },
      {
        "@type": "BreadcrumbList",
        itemListElement: [
          { "@type": "ListItem", position: 1, name: SITE_NAME, item: `${base}/` },
          { "@type": "ListItem", position: 2, name: "Partidos", item: url },
        ],
      },
    ],
  };
}

/** Drops undefined and empty-array fields so the JSON-LD stays clean. */
function prune(o: JsonLd): JsonLd {
  return Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined && !(Array.isArray(v) && v.length === 0)));
}

/** Serializes JSON-LD for a <script> tag; escapes "<" so data can't close the tag. */
export const jsonLdString = (data: JsonLd) => JSON.stringify(data).replace(/</g, "\\u003c");
