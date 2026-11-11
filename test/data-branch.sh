#!/bin/sh
# Round trip of scripts/data-branch.sh against a throwaway remote: check out the data branch into data/,
# record a crawl, push, and read it back from the remote. Needs git, rsync and node. Run from the repo root.
set -eu
tmp=$(mktemp -d)
remote="file://$tmp/remote.git"
id="-c user.name=test -c user.email=test@example.com"
git init -q --bare "$tmp/remote.git"

# A data branch holding the sample catalog.
git init -q -b data "$tmp/seed"
cp -r lib/fixtures/catalog/. "$tmp/seed/"
echo "# data" > "$tmp/seed/README.md"
git -C "$tmp/seed" add -A
git -C "$tmp/seed" $id commit -qm seed
git -C "$tmp/seed" push -q "$remote" data

# A checkout of main like the crawl jobs', with the remote as origin.
mkdir -p "$tmp/repo/data"
cp -r scripts lib crawlers "$tmp/repo/"
cp -r data/sources "$tmp/repo/data/"
cd "$tmp/repo"
git init -q -b main
git add -A
git $id commit -qm main
git remote add origin "$remote"

scripts/data-branch.sh checkout
test -f data/index.json
test -f data/federal/2003.json
test ! -e data/README.md

GITHUB_RUN_ID=1 node --experimental-strip-types --no-warnings scripts/crawl-run.ts start crawlers/federal/run.ts
scripts/data-branch.sh push "test: collecting"
git -C "$tmp/remote.git" show data:status/runs.json | grep -q '"status": "running"'
git -C "$tmp/remote.git" show data:federal/2003.json > /dev/null
git -C "$tmp/remote.git" show data:README.md > /dev/null
if git -C "$tmp/remote.git" cat-file -e data:sources 2> /dev/null; then
  echo "data/sources must stay on main" >&2
  exit 1
fi

# Nothing changed: no new commit.
before=$(git -C "$tmp/remote.git" rev-list --count data)
scripts/data-branch.sh push "test: nothing"
test "$(git -C "$tmp/remote.git" rev-list --count data)" = "$before"

GITHUB_RUN_ID=1 node --experimental-strip-types --no-warnings scripts/crawl-run.ts finish crawlers/federal/run.ts success
scripts/data-branch.sh push "test: success"
git -C "$tmp/remote.git" show data:status/runs.json | grep -q '"status": "success"'
test "$(git -C "$tmp/remote.git" rev-list --count data)" = "$((before + 1))"

rm -rf "$tmp"
echo "data branch round trip: ok"
