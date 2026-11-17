# Municipal laws crawler (capitals)

Collects **leis** and **leis complementares** of the 26 state capitals from each Câmara Municipal, with the authors
and each vereador's party at the time, and writes them through the shared store (`crawlers/lib/store.ts`; the nightly
job commits them to the `data` branch). It also sets each record's `executive`: the mayor elected for that term and their party, from TSE.

```sh
npm run crawl:municipal                                  # nightly default: last year + this year; a câmara with no data backfills from 1989
npm run crawl:municipal -- --cities Fortaleza,PB --since 2015
npm run crawl:municipal -- --dry-run --cities "São Paulo" --limit 40 --mayor-elections none
npm run crawl:municipal -- --manifests-only              # only rewrite data/sources/camara-municipal-*.json
```

The nightly workflow is `.github/workflows/crawl-municipal.yml` (08:30 UTC). On pull requests it runs a small live
dry-run against each câmara instead, with `--allow-unavailable` so a câmara whose server is down does not fail the PR.

Brasília is not a município: the Distrito Federal's laws come from the Câmara Legislativa (state crawler).

## Record rules

- `id`: `municipal-<IBGE>-<lei|lc>-<number>-<year>`, the same scheme as the Diários Oficiais crawler (Querido
  Diário), so a law found in both places is one record with both sources. `year` is the year of the law's date.
- `level` is `municipal`; `jurisdiction` is `"<City> (<UF>)"`.
- `authors[].party` is the vereador's party **on the bill's presentation date** (falling back to the law's date),
  from the câmara's own affiliation history. No affiliation covering that date means `null`; the current party is
  never used as a stand-in. Câmaras type acronyms by hand ("REP", "REPUB", "UNIÃO BRASIL"), so spellings are mapped
  to one name and current names are turned back into the name in use then (`normalizeParty` in `common.ts`).
- The mayor's bills have an author of kind `executive` with `party: null`.
- `executive` is the mayor **elected** for the term the law falls in (TSE `consulta_cand`, ordinary elections
  1996–2024; terms run 1 January after the election to 31 December four years later), marked `basis: "election"`.
  The party is the one they were elected under. A vice who took over, or a mid-term party switch, is not tracked.
  Laws before 1997 get no executive (TSE has no candidate files for 1988 and 1992). It is never derived from
  author data. The same pass fills `executive` on capitals' records from the Diários Oficiais crawler.
- `areas` is left empty for the classifier; titles, summaries and areas edited later are preserved on re-crawl.
- Every record links the câmara's own page for the law (SAPL `/norma/<id>`, or São Paulo's bill page), plus the
  full text when the câmara publishes it.

## Coverage

Checked on 2026-11-03.

| Capital | Status | Source | Notes |
| --- | --- | --- | --- |
| Porto Velho (RO) | covered | SAPL `sapl.portovelho.ro.leg.br` | |
| Rio Branco (AC) | covered | SAPL `sapl.riobranco.ac.leg.br` | |
| Manaus (AM) | covered | SAPL `sapl.cmm.am.gov.br` | |
| Boa Vista (RR) | covered | SAPL `sapl.boavista.rr.leg.br` | |
| Palmas (TO) | partial | SAPL `sapl.palmas.to.leg.br` | System adopted in 2023; only a handful of laws so far |
| Fortaleza (CE) | covered | SAPL `sapl.fortaleza.ce.leg.br` | |
| Natal (RN) | covered | SAPL `sapl.natal.rn.leg.br` | |
| João Pessoa (PB) | covered | SAPL `sapl.joaopessoa.pb.leg.br` | Its "Resolução" type carries LexML "lei"; types are matched by name only |
| Recife (PE) | covered | SAPL `sapl.recife.pe.leg.br` | Answered HTTP 503 on 2026-11-03; retried every night |
| São Paulo (SP) | covered | `splegisws.saopaulo.sp.leg.br/ws/ws2.asmx` | Laws per author (`LeisAprovadasPorPromovente`), joined by number; party from the câmara's affiliation history on the bill's year. Only PL bills (leis); Lei Orgânica amendments are out of scope |
| Belém, Macapá, São Luís, Teresina, Maceió, Aracaju, Salvador, Belo Horizonte, Vitória, Rio de Janeiro, Curitiba, Florianópolis, Porto Alegre, Campo Grande, Cuiabá, Goiânia | planned | — | Own systems, no SAPL found; not yet surveyed for an API. Laws in their Diários Oficiais still arrive through Querido Diário, without authors |

Each câmara has a manifest at `data/sources/camara-municipal-<city>.json`: `building` until its first good crawl,
then `active` or `failing`; câmaras without a crawler stay `planned`. Mayors update `data/sources/tse.json`.

## Files

- `cities.ts`: the 26 capitals, adapter per câmara, notes shown on the site.
- `sapl.ts`: SAPL adapter (reuses `crawlers/estadual/sapl.ts`, with municipal types, author kinds and ids).
- `cmsp.ts`: São Paulo adapter.
- `mayors.ts`: elected mayors from TSE (files cached in `.cache/tse`, GitHub Actions cache in the workflow).
- `common.ts`: law types, ids, party spellings, record builder.
