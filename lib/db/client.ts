// One Postgres client per process. Uses DATABASE_URL (set by the Neon integration on Vercel and
// as a GitHub Actions secret for the crawlers). postgres.js works with Neon's pooled URL and with
// a plain local Postgres, so tests and crawlers run without Neon.
import { drizzle, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema.ts";

export type Db = PostgresJsDatabase<typeof schema> & { $client: postgres.Sql };

let db: Db | undefined;

export function getDb(url = process.env.DATABASE_URL): Db {
  if (db) return db;
  if (!url) throw new Error("DATABASE_URL is not set");
  // prepare:false because Neon's pooled endpoint (PgBouncer, transaction mode) has no prepared statements.
  const client = postgres(url, { prepare: false, max: 5, onnotice: () => {} });
  return (db = drizzle(client, { schema }) as Db);
}

export async function closeDb(): Promise<void> {
  await db?.$client.end();
  db = undefined;
}
