// Where the catalog lives: the `data` branch of the repo holds <level>/<year>.json, index.json and status/
// (crawl state), written by the nightly crawl jobs (scripts/data-branch.sh). The Vercel build pulls it into
// data/ (scripts/data-pull.ts); /api/coletas reads status/ from it live.
export const REPO = "itsmegrave/lei-aberta";
export const DATA_BRANCH = "data";
export const DATA_BRANCH_RAW = `https://raw.githubusercontent.com/${REPO}/${DATA_BRANCH}`;
export const DATA_BRANCH_TARBALL = `https://codeload.github.com/${REPO}/tar.gz/refs/heads/${DATA_BRANCH}`;
/** Open-data dump on the "dados" release, published daily by export-data.yml. */
export const DUMP_URL = `https://github.com/${REPO}/releases/download/dados/leis.json.gz`;
