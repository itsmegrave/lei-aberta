# Lei Aberta

Leis do Brasil desde 1988, cada uma em uma frase, com quem propôs, quem sancionou e o link para o texto oficial. Filtre por tema, nível (federal, estadual, municipal), ano, partido de quem propôs, partido de quem sancionou e estado.

Open source. UI in Portuguese; code and comments in English.

## Stack

- Next.js (App Router) on Vercel. The home page, data files and sitemaps are prerendered at build time; each law page, short link and share image renders on its first visit and is then cached (`next.config.ts`), so the build stays fast with tens of thousands of laws
- TypeScript, Tailwind CSS 4, shadcn/ui (components live in `components/ui`), Recharts via the shadcn chart wrapper
- Motion for animation (all motion is off when the visitor prefers reduced motion)
- Fonts: Bricolage Grotesque and Figtree from Fontsource (bundled, no Google Fonts request)

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # all unit tests: test:unit + test:ui
npm run lint    # type check
npm run build   # production build (npm start serves it)
```

### Tests

- `npm run test:unit`: logic in `lib/` and `crawlers/` (`*.test.ts`), on Node's built-in `node:test`.
- `npm run test:ui`: React components (`components/**/*.test.tsx`) with Vitest, jsdom and React Testing Library. Shared setup is in `test/setup.ts`, and a sample law record is in `test/fixtures.ts`.
- `npm run test:db`: the Postgres layer (`lib/db/*.db.test.ts`) against a real, migrated database. It runs only when `TEST_DATABASE_URL` is set, never against `DATABASE_URL`, and it only touches ids that start with `test-db-`. CI runs it against a throwaway Postgres after the migrations.

## Hosting (Vercel)

The repo is linked to a Vercel project. Vercel detects Next.js. `vercel.json` only sets the content type and cache headers of the share images.

- Every push to `main` deploys to production.
- Every pull request gets a preview URL.
- The nightly crawl runs in GitHub Actions (free for public repos, up to 6 hours per run). It only crawls and commits JSON to `data/`; that commit triggers the Vercel deploy. There is no GitHub Pages deploy.

## Sharing

Each law has its own page, `/lei/<id>`, rendered on its first visit and cached until the next deploy. Next.js (`next/og`) draws a 1200x630 share image for every law (`app/lei/[id]/opengraph-image.tsx`): title, summary, year, topic, and who proposed and who signed with their party colors from the left-right survey. WhatsApp, X, Instagram and others show it as the link preview. Set `NEXT_PUBLIC_SITE_URL` in Vercel if the site moves to a custom domain, so preview links point to it.

Each law also has a short link, `/l/<code>`, which the share buttons use. The code is 7 characters derived from the law's id (`lib/share.ts`), so it never changes and needs no database or service; the build fails if two laws ever get the same code. The short link page shows the law itself instead of redirecting, so link previews work everywhere, and its canonical URL is the full page. Visits are counted by [Vercel Web Analytics](https://vercel.com/docs/analytics) as `/l/*` page views (turn it on under the project's Analytics tab).

## Search (SEO)

All search metadata is in Portuguese (`lang="pt-BR"`, `og:locale` `pt_BR`) and rendered on the server, so crawlers get plain HTML.

- **Site address.** `NEXT_PUBLIC_SITE_URL` sets the address used in canonical links, sitemaps, share links and structured data. Without it, Vercel builds use the project's production domain (`VERCEL_PROJECT_PRODUCTION_URL`, which becomes the custom domain once one is set as primary), and other builds use `https://lei-aberta.vercel.app`.
- **Titles and descriptions.** Home: "Lei Aberta: as leis do Brasil explicadas em uma frase". Law pages: "<título>: Lei 13.709/2018 · Lei Aberta", with the one-line summary as the description (`lib/seo.ts`).
- **Sitemaps.** `/sitemap.xml` is a sitemap index pointing to `/sitemaps/paginas.xml` and `/sitemaps/leis-N.xml` (10,000 laws per file, Google allows 50,000), each law with its share image.
- **robots.txt.** Allows everything and points to the sitemap. Preview deployments (`VERCEL_ENV` other than `production`) disallow everything.
- **Structured data (JSON-LD).** Home: `WebSite` with a `SearchAction` (`/?q=termo` opens the home with that search) and `Organization`. Law pages: `Legislation` (identifier, type, date, jurisdiction, authors with their party at authorship, official text as `sameAs`) and `BreadcrumbList`. Only facts from the record are stated.
- **Links.** Law cards on the home are real links to `/lei/<id>`, so crawlers can follow them; a plain click still opens the sheet.
- **Search Console.** The Google ownership token is in `app/layout.tsx` (`NEXT_PUBLIC_GOOGLE_SITE_VERIFICATION` overrides it); optional `NEXT_PUBLIC_BING_SITE_VERIFICATION` adds the Bing tag. After the first production deploy, submit `/sitemap.xml` in Google Search Console and Bing Webmaster Tools.

## Data

`data/index.json` lists every file; records live in `data/<level>/<year>.json`. Each record:

| field | notes |
| --- | --- |
| `id`, `level`, `jurisdiction`, `type`, `number`, `title`, `summary`, `year`, `presentedAt`, `status`, `areas` | `summary` is one or two plain sentences |
| `authors[{name, kind, party, uf}]` | `party` is the author's party **at the time of authorship** |
| `parties` | author parties, deduplicated |
| `executive{name, office, party}` | who signed it (president, governor, mayor). **Separate from author party, never merged** |
| `sources[{label, url}]` | at least one official URL, always |

The current files are a sample of well-known federal laws. Their Planalto links were written by hand and should be checked before launch.

State laws (`data/estadual/`) come from the state legislatures; coverage per state and the crawler rules are in [`crawlers/estadual/README.md`](crawlers/estadual/README.md).

### Postgres (in progress)

The catalog is moving from these JSON files to Postgres (Neon, via the Vercel Marketplace, free tier). Until the site and crawlers are switched over, `data/` stays the source of truth and the database is a copy.

- Schema: `lib/db/schema.ts` (Drizzle). One `policies` table; filter fields are columns (`level`, `year`, `jurisdiction`, `executive_party`), `areas` and `parties` are indexed arrays, `authors`/`sources`/`executive` are JSON, and `search` is a Portuguese full-text vector over title and summary. `executive_party` is a copy of `executive.party` and is never mixed with `parties`.
- Migrations live in `drizzle/`. After changing the schema run `npm run db:generate`, then `npm run db:migrate`.
- `npm run db:import-json` loads every record in `data/` into `DATABASE_URL` (idempotent; refuses to run if any record fails validation).
- Neon is installed through the Vercel Marketplace and sets `DATABASE_URL` (pooled) and `DATABASE_URL_UNPOOLED` on the project. On production deploys `scripts/db-deploy.sh` (the `vercel-build` script) applies migrations and syncs `data/` into the database; preview deploys share that database and skip it.
- Local: any Postgres 16 works, e.g. `DATABASE_URL=postgres://postgres:postgres@localhost:5432/lei_aberta`.

### How the site loads it

The home page never ships the whole catalog. At build time `app/dados/[file]/route.ts` writes static files (see `lib/listing.ts`):

- `/dados/pagina-<n>.json`: the cards of page *n*, 24 per page, newest first.
- `/dados/indice.json`: one compact row per law (level, year, topics, author and executive party buckets, states, title text), fetched only when someone filters or searches.

The HTML carries page 1 and the unfiltered chart numbers. Filters and the page live in the URL (`?tema=saude&pagina=2`), so any view can be shared.

## Data sources manifest

The "De onde vêm os dados" section on the home page is built from `data/sources/<id>.json`, one file per source. Each crawler owns its own file, so crawlers never edit the same file. The type and validation are in `lib/sources.ts`.

```jsonc
{
  "id": "senado",                       // kebab-case, equals the file name
  "name": "Senado Federal",             // shown on the site (pt-BR)
  "publisher": "Senado Federal",
  "url": "https://legis.senado.leg.br/dadosabertos/",  // https, official
  "levels": ["federal"],                // federal | estadual | municipal
  "coverage": ["Brasil"],               // e.g. ["SP"] or ["Municípios do Querido Diário"]
  "covers": ["lei", "lei complementar", "medida provisória"],
  "description": "One plain sentence in Portuguese.",
  "status": "active",                   // active | building | planned | failing
  "since": 1988,                        // optional: first year covered
  "records": 812,                       // optional: records in data/ from this source
  "lastRun": "2026-11-01T03:00:00Z",    // optional ISO: any attempt
  "lastSuccess": "2026-11-01T03:00:00Z",// required when status is active
  "crawler": "crawlers/federal/run.ts"  // optional
}
```

At the end of each run a crawler calls `updateSource(id, patch)` from `lib/sources-store.ts`. It merges the patch, validates it and writes the file. On success, pass `status: "active"`, `records`, `lastRun` and `lastSuccess`. On failure, pass `status: "failing"` and `lastRun`. The build fails if any file is invalid.

## Party positions

Party colors on the left-right chart come from the expert survey in Bolognesi, Ribeiro & Codato (2023), *A New Ideological Classification of Brazilian Political Parties*, Dados 66(2), [doi:10.1590/dados.2023.66.2.303](https://doi.org/10.1590/dados.2023.66.2.303), Table 1 (0 = left, 10 = right). We do not score parties ourselves. Parties not in the survey get no position and are listed apart. The palette runs red (left) → gray (center) → blue (right), following the common convention of red for the left. All stops live in one place, `SPECTRUM_STOPS` in `lib/party-spectrum.ts`, with separate light and dark values; every chart, legend and share image reads from there.

## Parties: current names and directory

Records keep the author's party **at the time of authorship** (and the executive's party at signing). Charts and filters group each party under its **current name**, so a party's whole history counts in one place: PMDB → MDB, PFL and DEM → União Brasil, PPS → Cidadania, PR → PL, PRN and PTC → Agir. The mapping and its sources are in `lib/parties.ts`:

- `PARTIES`: the 30 parties registered at the TSE (checked 2026-10-31 against the [TSE list](https://www.tse.jus.br/partidos/partidos-registrados-no-tse)): name, number, registration date, official site, a one-line neutral description and the national history (founding, renames, mergers, incorporations).
- `ALIASES`: every older code and the party it belongs to today. Codes reused by different parties are split by year (the PCB before 1992 is today's Cidadania; the PSD before 2011 went to the PTB, now PRD).
- Scores: a rename keeps the survey score (MDB, Cidadania, PL, Agir...). A party created by a merger after the survey (União Brasil, PRD) gets no score: we don't average its predecessors. On a law, the party at the time keeps its own score (a DEM author is colored as DEM).
- Old filter links (`?autor=PMDB`) open the current party.

Party pages: `/partidos` (all parties, ordered by laws in the catalog, then name) and `/partidos/<slug>` (description, timeline, site and TSE links, position, laws per year, topics, names used in the records, newest laws). Both are in `/sitemaps/paginas.xml` with `PoliticalParty`, `CollectionPage` and `BreadcrumbList` JSON-LD.

## Neutrality

Describe, never rate. No adjectives about parties or policies, no party brand colors, sort by count then name.

## Credits

- 3D illustrations: [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) by Microsoft, MIT.
- State outlines: [geodata-br-states](https://github.com/giuliano-oliveira/geodata-br-states), MIT, built from IBGE data via LAGEAMB/UFPR. Simplified to `lib/br-map.json`.
- Chart color method: validated categorical and sequential palettes for light and dark.

## Design notes

See `docs/design.md`.

## License

Code is released under the [MIT License](LICENSE). Laws and official texts linked from the site are public under Brazilian law (Lei 9.610/1998, art. 8º, IV) and keep their original sources.
