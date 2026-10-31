// Applies the SQL migrations in drizzle/ to DATABASE_URL. Safe to run on every deploy.
import { migrate } from "drizzle-orm/postgres-js/migrator";
import { closeDb, getDb } from "../lib/db/client.ts";

await migrate(getDb(), { migrationsFolder: new URL("../drizzle", import.meta.url).pathname });
await closeDb();
console.log("migrations applied");
