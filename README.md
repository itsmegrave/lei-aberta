# Lei Aberta

Leis do Brasil desde 1988, cada uma em uma frase, com quem propôs, quem sancionou e o link para o texto oficial. Filtre por tema, nível (federal, estadual, municipal), ano, partido de quem propôs, partido de quem sancionou e estado.

Open source. UI in Portuguese; code and comments in English.

## Stack

- Next.js (App Router, `output: "export"`, so the build is plain static files in `out/`)
- TypeScript, Tailwind CSS 4, shadcn/ui (components live in `components/ui`), Recharts via the shadcn chart wrapper
- Motion for animation (all motion is off when the visitor prefers reduced motion)
- Fonts: Bricolage Grotesque and Figtree from Fontsource (bundled, no Google Fonts request)

```bash
npm install
npm run dev     # http://localhost:3000
npm test        # unit tests (node:test, no extra runner)
npm run lint    # type check
npm run build   # static export to out/
```

## Hosting (Vercel)

The repo is linked to a Vercel project. Vercel detects Next.js and serves the static export, so there is no `vercel.json`.

- Every push to `main` deploys to production.
- Every pull request gets a preview URL.
- The nightly crawl runs in GitHub Actions (free for public repos, up to 6 hours per run). It only crawls and commits JSON to `data/`; that commit triggers the Vercel deploy. There is no GitHub Pages deploy.

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

Party colors on the left-right chart come from the expert survey in Bolognesi, Ribeiro & Codato (2023), *A New Ideological Classification of Brazilian Political Parties*, Dados 66(2), [doi:10.1590/dados.2023.66.2.303](https://doi.org/10.1590/dados.2023.66.2.303), Table 1 (0 = left, 10 = right). We do not score parties ourselves. Formal renames reuse the same party's score (PMDB→MDB, PFL→DEM, PRN→PTC, and so on, see `lib/party-spectrum.ts`). Parties not in the survey get no position and are listed apart. The palette is violet → gray → ochre, with no red/green so no side reads as "good" or "bad".

## Neutrality

Describe, never rate. No adjectives about parties or policies, no party brand colors, sort by count then name.

## Credits

- 3D illustrations: [Fluent Emoji](https://github.com/microsoft/fluentui-emoji) by Microsoft, MIT.
- State outlines: [geodata-br-states](https://github.com/giuliano-oliveira/geodata-br-states), MIT, built from IBGE data via LAGEAMB/UFPR. Simplified to `lib/br-map.json`.
- Chart color method: validated categorical and sequential palettes for light and dark.

## Design notes

See `docs/design.md`.
