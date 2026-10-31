# Diários Oficiais crawler

Reads the official gazettes and merges what it finds into `data/` through the shared store (`crawlers/lib/store.ts`). Runs every night from `.github/workflows/crawl-diarios.yml`.

```bash
npm run crawl:diarios -- --dry-run                  # last few days, print only
npm run crawl:diarios -- --source dou --since 2024-09-01 --until 2024-09-30
npm run crawl:diarios -- --source qd --territories 3550308,3304557
```

## Sources

| Source | What we take | Record ids | Merge |
| --- | --- | --- | --- |
| **Diário Oficial da União**, Seção 1 (regular, extra edition, supplement), from the in.gov.br "leitura do jornal" page | Leis, leis complementares, medidas provisórias, emendas constitucionais. Decrees, portarias and the rest are skipped. The ementa comes from each act's page. | `federal-lei-<n>-<year>`, `federal-lc-…`, `federal-mp-…`, `federal-ec-…` (same ids as the federal crawler) | `owner: false`: the federal crawler owns authors, parties, executive and status. The DOU only fills empty fields and adds its link as a source. |
| **Diários Oficiais municipais** through the [Querido Diário](https://queridodiario.ok.org.br) API (Open Knowledge Brasil) | Law headings in capitals ("LEI Nº 1.234, DE 5 DE MARÇO DE 2024") and the ementa below them. Bills (projeto de lei), autógrafos and lowercase citations are ignored. | `municipal-<IBGE code>-lei-<n>-<year>`, `municipal-<IBGE>-lc-…` | `owner: true`, keeping `title`, `summary` and `areas` once set. |

**DOU access.** The public in.gov.br site drops requests that don't look like a browser (seen from GitHub runners in Oct 2026). With `INLABS_EMAIL` and `INLABS_PASSWORD` set (GitHub secrets), the crawler instead downloads each day's Seção 1 ZIP from [INLABS](https://inlabs.in.gov.br), Imprensa Nacional's service for automated access (free account), and links each act to its page on pesquisa.in.gov.br.

Nightly runs read the last 3 days of the DOU and the last 7 days of Querido Diário (it indexes gazettes a few days late). Re-reading a day is harmless: records are upserted by id.

## Source manifest

At the end of each run the crawler updates `data/sources/dou.json` and `data/sources/querido-diario.json` (via `updateSource` in `lib/sources-store.ts`): `active` with the record count after a run that read data, `failing` when the source could not be read. The workflow commits these files even when the crawl step fails, so the home page shows the failure.

## Rules this crawler keeps

- **Official link on every record.** DOU links are on in.gov.br. Querido Diário serves its own copy of each gazette, so municipal records also carry the city hall's portal (`portals.ts`). Each run checks the portal answers; a city whose portal is down or unknown is skipped and logged, never published without an official link.
- **Author party and executive party stay apart.** The DOU does not say who wrote a bill, so `authors` is empty for laws until the federal crawler fills it. MPs are authored by "Poder Executivo" with no party. `executive` is never set here: the president comes from the federal crawler, and mayors' parties need TSE data (roadmap).
- **No areas.** `areas` stays empty for the area classifier.

## Not covered yet

- **State Diários Oficiais.** There is no common API: each state publishes its DOE on its own system (some only as PDF), so it would take one scraper per state. State laws are crawled from the legislative assemblies instead, in the state-laws crawler.
- **Municipalities beyond the capitals.** `--territories all` reads every city Querido Diário covers, but only the capitals have an official portal mapped in `portals.ts`. Add a city's portal to include it.
- **Mayor's party** (`executive` on municipal records): needs the TSE election results.
