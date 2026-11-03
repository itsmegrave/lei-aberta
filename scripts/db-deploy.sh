#!/bin/sh
# Runs before `next build` on Vercel (package.json "vercel-build"): applies pending migrations.
# Laws live in Postgres (the nightly crawlers write them), so nothing is imported here anymore.
# The Neon integration gives each preview deploy its own database branch, copied from production,
# so previews migrate their own branch and never touch production data.
set -e
if [ -n "$VERCEL" ] && [ -n "$DATABASE_URL" ]; then
  npm run -s db:migrate
else
  echo "db: skipped (not on Vercel or no DATABASE_URL)"
fi
