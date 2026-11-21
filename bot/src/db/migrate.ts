/**
 * Minimal migration runner: applies db/migrations/*.sql in filename
 * order, once each, tracked in schema_migrations. Every migration runs in
 * its own transaction — a failed migration leaves no partial schema.
 * Usage: DATABASE_URL=... node dist/db/migrate.js
 */
import { Pool } from "pg";
import * as fs from "node:fs";
import * as path from "node:path";

export async function runMigrations(pool: Pool, migrationsDir: string): Promise<string[]> {
  await pool.query(
    `CREATE TABLE IF NOT EXISTS schema_migrations (
       name TEXT PRIMARY KEY,
       applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
     )`,
  );
  const files = fs
    .readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();
  const applied: string[] = [];
  for (const file of files) {
    const seen = await pool.query("SELECT 1 FROM schema_migrations WHERE name = $1", [file]);
    if (seen.rowCount && seen.rowCount > 0) continue;
    const sql = fs.readFileSync(path.join(migrationsDir, file), "utf8");
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(sql);
      await client.query("INSERT INTO schema_migrations (name) VALUES ($1)", [file]);
      await client.query("COMMIT");
      applied.push(file);
    } catch (err) {
      await client.query("ROLLBACK");
      throw err;
    } finally {
      client.release();
    }
  }
  return applied;
}

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("[puni] DATABASE_URL is missing");
    process.exit(1);
  }
  const pool = new Pool({ connectionString: url });
  const dir = path.resolve(__dirname, "../../../db/migrations");
  const applied = await runMigrations(pool, dir);
  console.log(applied.length ? `[puni] migrations applied: ${applied.join(", ")}` : "[puni] migrations up to date");
  await pool.end();
}

if (require.main === module) {
  main().catch((err) => {
    console.error("[puni] migration failed", err);
    process.exit(1);
  });
}
