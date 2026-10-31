#!/bin/sh
# Runs before `next build` on Vercel (package.json "vercel-build").
# Applies migrations and syncs data/ into Postgres, so the database tracks the JSON until the
# crawlers write to it directly. The Neon integration gives each preview deploy its own database
# branch (the first preview of #22 found no tables there), so previews migrate and import too.
set -e
if [ -n "$VERCEL" ] && [ -n "$DATABASE_URL" ]; then
  npm run -s db:migrate
  npm run -s db:import-json
else
  echo "db: skipped (not on Vercel or no DATABASE_URL)"
fi
