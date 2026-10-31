#!/bin/sh
# Runs before `next build` on Vercel (package.json "vercel-build").
# Production deploys apply migrations and sync data/ into Postgres, so the database tracks the
# JSON until the crawlers write to it directly. Preview deploys share the same database, so they
# skip this to keep unmerged migrations off it.
set -e
if [ "$VERCEL_ENV" = "production" ] && [ -n "$DATABASE_URL" ]; then
  npm run -s db:migrate
  npm run -s db:import-json
else
  echo "db: skipped (VERCEL_ENV=${VERCEL_ENV:-unset})"
fi
