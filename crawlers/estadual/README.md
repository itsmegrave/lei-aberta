# State laws crawler

Collects state **leis**, **leis complementares** and **emendas constitucionais** (1989 onward) from the 27 state
legislatures and writes them to `data/estadual/<year>.json` through the shared store (`crawlers/lib/store.ts`).
Decrees, resolutions and legislative decrees are out of scope.

```sh
npm run crawl:estadual                         # nightly default: last year + this year; first run of a house backfills from 1989
npm run crawl:estadual -- --states PB,RO --since 2015
npm run crawl:estadual -- --dry-run --states SP
npm run crawl:estadual -- --manifests-only     # only rewrite data/sources/assembleia-*.json
```

The nightly workflow is `.github/workflows/crawl-estadual.yml` (07:30 UTC). On pull requests it runs a small live dry-run against each house instead. It can be run by hand with `states` and
`since` inputs, for example `since=1989` for a full backfill.

## Record rules

- `id`: `estadual-<uf>-<type>-<number>-<year>`, e.g. `estadual-sp-lei-17890-2024`. `type` is `lei`,
  `lei-complementar` or `emenda-constitucional`. `year` is the year of the law's date.
- `level` is `estadual`; `jurisdiction` is the state name.
- `authors[].party` is the deputy's party **on the bill's presentation date** (falling back to the law's date), taken
  from SAPL's affiliation history. When no affiliation covers that date the party is `null`. We never use a deputy's
  current party as a stand-in.
- Alesp (SP) publishes no affiliation history, so SP deputies get the party they were **elected under** in the last
  state election before the law, from TSE candidate data (`consulta_cand_<year>.zip`, matched by ballot or full name;
  suplentes count; ambiguous names stay `null`). Those authors carry `partyBasis: "election"`. TSE files for past
  elections are cached in `.cache/tse` (GitHub Actions cache).
- Bills sent by the governor have an author of kind `executive` with `party: null`.
- `executive` (the governor who signed) is left `null` here. It comes from TSE election data, as a separate field,
  and is never derived from author data.
- `areas` is left empty for the classifier; titles, summaries and areas edited later are preserved on re-crawl.
- Every record links the assembly's own page for the law (SAPL `/norma/<id>` or the Alesp ficha), plus the full-text
  PDF when the house publishes one.

## Politeness

`http.ts` identifies itself as `LeiAbertaBot`, reads each host's `robots.txt` and skips what it disallows, keeps a
300 ms gap between requests to the same host, and retries 429/5xx with backoff. Houses run in parallel because they
are on different hosts.

## Coverage

Checked on 2026-10-31. "SAPL" means the house runs Interlegis SAPL 3.x, whose API is the same everywhere
(`/api/norma/normajuridica/`), so one adapter covers all of them.

| UF | House | Status | Source | Notes |
| --- | --- | --- | --- | --- |
| AC | Assembleia Legislativa do Acre | covered | SAPL `sapl.al.ac.leg.br` | API answered (3.7k norms) |
| AL | Assembleia Legislativa de Alagoas | covered | SAPL `sapl.al.al.leg.br` | API answered (4k norms) |
| AM | Assembleia Legislativa do Amazonas | covered | SAPL `sapl.al.am.leg.br` | API answered (15k norms) |
| PB | Assembleia Legislativa da Paraíba | covered | SAPL `sapl.al.pb.leg.br` | API answered (17.7k norms) |
| PI | Assembleia Legislativa do Piauí | covered | SAPL `sapl.al.pi.leg.br` | API answered |
| RO | Assembleia Legislativa de Rondônia | covered | SAPL `sapl.al.ro.leg.br` | API answered (12.4k norms) |
| TO | Assembleia Legislativa do Tocantins | partial | SAPL `sapl.al.to.leg.br` | Laws and authors, but the house publishes no party affiliations, so `party` is null |
| SP | Assembleia Legislativa de São Paulo | covered | Alesp open data (XML dumps) + TSE candidates | Authors come from the law record (long lists are cut with "e outros"). Alesp has no affiliation history, so a deputy's party is the one they were elected under in the last state election (TSE), marked `partyBasis: "election"` |
| AP | Assembleia Legislativa do Amapá | blocked | SAPL `sapl.al.ap.leg.br` | robots.txt disallows automated access |
| MS | Assembleia Legislativa de Mato Grosso do Sul | blocked | SAPL `sapl.al.ms.leg.br` | robots.txt disallows automated access |
| SE | Assembleia Legislativa de Sergipe | blocked | SAPL `sapl.al.se.leg.br` | robots.txt disallows automated access |
| RR | Assembleia Legislativa de Roraima | blocked | SAPL `sapl.al.rr.leg.br` | API answers HTTP 403 to automated requests |
| MG | Assembleia Legislativa de Minas Gerais | blocked | ALMG API `dadosabertos.almg.gov.br/ws/legislacao` | Good API, but robots.txt disallows automated access |
| BA, CE, DF, ES, GO, MA, MT, PA, PE, PR, RJ, RN, RS, SC | — | planned | — | Own portals; not yet surveyed for an API or dump |

"Blocked" houses can be unblocked by asking the assembly to allow `LeiAbertaBot` in robots.txt (MG's API is the most
valuable). The crawler checks robots.txt on every run, so an allowed house starts working with no code change once its
adapter is set in `states.ts`.

Each house also has a manifest at `data/sources/assembleia-<uf>.json`, rewritten by every run: `building` until its
first successful crawl, then `active` or `failing`; houses without a crawler stay `planned`.

## Files

- `states.ts`: the 27 houses, adapter per house, notes shown on the site.
- `sapl.ts`: SAPL adapter (law types per house, bills, authors, party on the presentation date).
- `alesp.ts`: Alesp adapter (ZIP/XML dumps, streamed).
- `zip.ts`: dependency-free ZIP reader and streaming XML row splitter.
- `common.ts`: law-type detection, ids, titles, record builder.
- `http.ts`: polite fetch with robots.txt, per-host throttle and retries.
