/** Shard worker entry — spawned by the launcher (index.ts), one process
 *  per shard (spec 2.5). All state lives in shared stores, never in this
 *  process, so shards are disposable workers.
 *
 *  With DATABASE_URL set, state is PostgreSQL (production). Without it,
 *  the shard falls back to in-memory stores with a loud warning — data
 *  will not survive a restart in that mode. */
import * as path from "node:path";
import { Pool } from "pg";
import { loadConfig } from "./config";
import { InMemoryGuildSettings, type GuildSettingsProvider } from "./guild-settings";
import { buildBot } from "./registry";
import { createBotClient } from "./client";
import { runMigrations } from "./db/migrate";
import { PgGuildSettings } from "./db/pg-guild-settings";
import { PgEconomyStore } from "./db/pg-economy-store";
import type { EconomyStore } from "./services/economy";

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.token) {
    console.error("[puni] DISCORD_BOT_TOKEN is missing — set it in the environment.");
    process.exit(1);
  }

  let settings: GuildSettingsProvider;
  let economyStore: EconomyStore | undefined;
  if (config.databaseUrl) {
    const pool = new Pool({ connectionString: config.databaseUrl });
    const applied = await runMigrations(pool, path.resolve(__dirname, "../../db/migrations"));
    if (applied.length) console.log(`[puni] migrations applied: ${applied.join(", ")}`);
    settings = new PgGuildSettings(pool, config.defaultPrefix);
    economyStore = new PgEconomyStore(pool);
    console.log("[puni] state: PostgreSQL");
  } else {
    console.warn("[puni] DATABASE_URL not set — IN-MEMORY state, data will NOT survive restart");
    settings = new InMemoryGuildSettings(config.defaultPrefix);
  }

  const { registry } = buildBot({ settings, economyStore });
  const client = createBotClient({ config, registry, settings });
  await client.login(config.token);
}

main().catch((err) => {
  console.error("[puni] shard failed to start", err);
  process.exit(1);
});
