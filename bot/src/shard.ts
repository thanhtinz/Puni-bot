/** Shard worker entry — spawned by the launcher (index.ts), one process
 *  per shard (spec 2.5). All state lives in shared stores, never in this
 *  process, so shards are disposable workers.
 *
 *  With DATABASE_URL set, state is PostgreSQL (production). Without it,
 *  the shard falls back to in-memory stores with a loud warning — data
 *  will not survive a restart in that mode. */
import * as path from "node:path";
import { Pool } from "pg";
import Redis from "ioredis";
import { loadConfig } from "./config";
import { InMemoryGuildSettings, type GuildSettingsProvider } from "./guild-settings";
import { buildBot } from "./registry";
import { createBotClient } from "./client";
import { RedisCooldownStore } from "./services/redis-cooldown";
import type { CooldownStore } from "./dispatcher";
import { runMigrations } from "./db/migrate";
import { PgGuildSettings } from "./db/pg-guild-settings";
import { PgEconomyStore } from "./db/pg-economy-store";
import { PgModCaseStore } from "./db/pg-mod-cases";
import type { EconomyStore } from "./services/economy";
import type { ModCaseStore } from "./services/mod-cases";

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.token) {
    console.error("[puni] DISCORD_BOT_TOKEN is missing — set it in the environment.");
    process.exit(1);
  }

  let settings: GuildSettingsProvider;
  let economyStore: EconomyStore | undefined;
  let caseStore: ModCaseStore | undefined;
  if (config.databaseUrl) {
    const pool = new Pool({ connectionString: config.databaseUrl });
    const applied = await runMigrations(pool, path.resolve(__dirname, "../../db/migrations"));
    if (applied.length) console.log(`[puni] migrations applied: ${applied.join(", ")}`);
    settings = new PgGuildSettings(pool, config.defaultPrefix);
    economyStore = new PgEconomyStore(pool);
    caseStore = new PgModCaseStore(pool);
    console.log("[puni] state: PostgreSQL");
  } else {
    console.warn("[puni] DATABASE_URL not set — IN-MEMORY state, data will NOT survive restart");
    settings = new InMemoryGuildSettings(config.defaultPrefix);
  }

  let cooldownStore: CooldownStore | undefined;
  if (config.redisUrl) {
    cooldownStore = new RedisCooldownStore(new Redis(config.redisUrl));
    console.log("[puni] cooldowns: Redis (shared across cluster)");
  }

  let aiChat: import("./services/ai-chat").AiChatService | undefined;
  if (config.ai.apiKey) {
    const { AiChatService, OpenAiCompatibleProvider } = await import("./services/ai-chat");
    aiChat = new AiChatService(
      new OpenAiCompatibleProvider({
        baseUrl: config.ai.baseUrl,
        apiKey: config.ai.apiKey,
        model: config.ai.model,
      }),
      { cooldownStore },
    );
    console.log(`[puni] ai chat: on (model ${config.ai.model})`);
  }

  const bot = buildBot({ settings, economyStore, caseStore });
  const client = createBotClient({
    config,
    registry: bot.registry,
    settings,
    cooldownStore,
    enforcer: bot.enforcer,
    cases: bot.cases,
    addCaseHook: bot.addCaseHook,
    aiChat,
  });
  await client.login(config.token);
}

main().catch((err) => {
  console.error("[puni] shard failed to start", err);
  process.exit(1);
});
