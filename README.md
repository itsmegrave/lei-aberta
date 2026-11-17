# Lei Aberta: dados

Every law in the catalog, written by the nightly crawlers (see `.github/workflows/crawl-*.yml` on main).

- `<level>/<year>.json`: the laws of one level (federal, estadual, municipal) and year.
- `index.json`: every file above, with its record count.
- `status/sources.json`: crawl state of each source (status, counts, last run, cursor).
- `status/runs.json`: the latest run of each crawler, shown live on the site.

Don't edit by hand: the crawlers overwrite these files.
