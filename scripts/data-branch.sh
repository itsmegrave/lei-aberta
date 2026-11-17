#!/usr/bin/env bash
# The catalog lives on the `data` branch, not on main (main only takes pull requests): <level>/<year>.json,
# index.json and status/ (crawl state and the latest run of each crawler). The crawl workflows use this script:
#   scripts/data-branch.sh checkout          # worktree of the branch in .data-branch, copied into data/
#   scripts/data-branch.sh push "message"    # copies data/ back (not data/sources) and pushes, if anything changed
# The first checkout, when the branch doesn't exist yet, starts it from the latest open-data dump.
set -euo pipefail

BRANCH=data
WT=.data-branch

checkout() {
  local found=0
  git ls-remote --exit-code --heads origin "$BRANCH" >/dev/null || found=$?
  # 2 means "no such branch"; anything else is a failure, which must not start a new branch over the real one.
  if [ "$found" != 0 ] && [ "$found" != 2 ]; then
    echo "::error::could not reach origin (git ls-remote exited with $found)"
    exit 1
  fi
  if [ "$found" = 0 ]; then
    git fetch --depth=1 origin "+refs/heads/$BRANCH:refs/remotes/origin/$BRANCH"
    git worktree add -f -B "$BRANCH" "$WT" "origin/$BRANCH"
  else
    echo "No $BRANCH branch yet: starting one from the open-data dump."
    git worktree add -f --orphan -b "$BRANCH" "$WT"
    node --experimental-strip-types --no-warnings scripts/data-pull.ts --from-dump "$WT"
    cat > "$WT/README.md" <<'EOF'
# Lei Aberta: dados

Every law in the catalog, written by the nightly crawlers (see `.github/workflows/crawl-*.yml` on main).

- `<level>/<year>.json`: the laws of one level (federal, estadual, municipal) and year.
- `index.json`: every file above, with its record count.
- `status/sources.json`: crawl state of each source (status, counts, last run, cursor).
- `status/runs.json`: the latest run of each crawler, shown live on the site.

Don't edit by hand: the crawlers overwrite these files.
EOF
    # This branch has no site to build.
    echo '{ "git": { "deploymentEnabled": false } }' > "$WT/vercel.json"
  fi
  mkdir -p data
  tar -C "$WT" --exclude=./.git --exclude=./README.md --exclude=./vercel.json -cf - . | tar -C data -xf -
}

push() {
  local message=${1:-"Update data"}
  # Never commit from anywhere but the data worktree (a failed checkout leaves none).
  if [ ! -e "$WT/.git" ]; then
    echo "::error::no $BRANCH worktree in $WT; run checkout first"
    exit 1
  fi
  # data/sources (manifests) stays on main; ids.json is derived at build time.
  if [ ! -f data/index.json ]; then
    echo "::error::data/index.json is missing; refusing to replace the $BRANCH branch with an empty catalog"
    exit 1
  fi
  # Replace the branch's files with data/, so records removed by a crawl go away too.
  find "$WT" -mindepth 1 -maxdepth 1 ! -name .git ! -name README.md ! -name vercel.json -exec rm -rf {} +
  tar -C data --exclude=./sources --exclude=./ids.json --exclude=./README.md --exclude=./vercel.json -cf - . | tar -C "$WT" -xf -
  cd "$WT"
  git add -A
  if git diff --cached --quiet; then
    echo "No data changes."
    return
  fi
  git -c user.name="github-actions[bot]" -c user.email="41898282+github-actions[bot]@users.noreply.github.com" commit -q -m "$message"
  for attempt in 1 2 3 4 5; do
    if git push -q origin "HEAD:refs/heads/$BRANCH"; then
      echo "Pushed to $BRANCH: $message"
      return
    fi
    # Crawl jobs share a concurrency group, so a race is rare; rebase on whatever got there first.
    sleep $((attempt * 3))
    git pull -q --rebase origin "$BRANCH"
  done
  echo "::error::could not push to the $BRANCH branch"
  exit 1
}

case "${1:-}" in
  checkout) checkout ;;
  push) push "${2:-}" ;;
  *) echo "usage: $0 checkout | push [message]" >&2; exit 2 ;;
esac
