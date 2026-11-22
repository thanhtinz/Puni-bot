/** Shard worker entry — spawned by the launcher (index.ts), one process
 *  per shard (spec 2.5). All state lives in shared stores, never in this
 *  process, so shards are disposable workers.
 *
 *  With DATABASE_URL set, state is PostgreSQL (production). Without it,
 *  the shard falls back to in-memory stores with a loud warning — data
 *  will not survive a restart in that mode.
 *
 *  Puni is a pure game bot (spec 6.28): TCG + economy + marriage.
 *  No server-management wiring exists in this process anymore. */
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
import { PgBotConfig } from "./db/pg-bot-config";
import type { EconomyStore } from "./services/economy";

async function main(): Promise<void> {
  const config = loadConfig();
  if (!config.token) {
    console.error("[puni] DISCORD_BOT_TOKEN is missing — set it in the environment.");
    process.exit(1);
  }

  let settings: GuildSettingsProvider;
  let economyStore: EconomyStore | undefined;
  let botConfig: PgBotConfig | undefined;
  let membershipStore: import("./services/membership").MembershipStore | undefined;
  let membershipOrders: import("./services/membership").MembershipOrderStore | undefined;
  let marriageStore: import("./services/marriage").MarriageStore | undefined;
  let tcgStore: import("./services/tcg-store").TcgStore | undefined;
  let pgPool: Pool | undefined;
  if (config.databaseUrl) {
    const pool = new Pool({ connectionString: config.databaseUrl });
    pgPool = pool;
    const applied = await runMigrations(pool, path.resolve(__dirname, "../../db/migrations"));
    if (applied.length) console.log(`[puni] migrations applied: ${applied.join(", ")}`);
    settings = new PgGuildSettings(pool, config.defaultPrefix);
    economyStore = new PgEconomyStore(pool);
    botConfig = new PgBotConfig(pool);
    const { PgMembershipStore } = await import("./db/pg-membership-store");
    membershipStore = new PgMembershipStore(pool);
    const { PgMembershipOrderStore } = await import("./db/pg-membership-orders");
    membershipOrders = new PgMembershipOrderStore(pool);
    const { PgMarriageStore } = await import("./db/pg-marriage-store");
    marriageStore = new PgMarriageStore(pool);
    const { PgTcgStore } = await import("./db/pg-tcg-store");
    tcgStore = new PgTcgStore(pool);
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

  const bot = buildBot({
    settings,
    economyStore,
    membershipStore,
    membershipOrders,
    marriageStore,
    ringTiersSource: botConfig ? () => botConfig.getRingTiers() : undefined,
    tcgStore,
    tcgCatalogSource: pgPool
      ? async () => {
          const res = await pgPool!.query<{ id: string; name: string; rarity: string; evolves_to: string | null; base_hp: number; base_atk: number; member_exclusive: boolean; set_id: string }>(
            `SELECT id, name, rarity, evolves_to, base_hp, base_atk, member_exclusive, set_id FROM game_species WHERE enabled = true`,
          );
          return res.rows.map((r) => ({
            id: r.id,
            name: r.name,
            rarity: r.rarity as import("./services/tcg").TcgRarity,
            evolvesTo: r.evolves_to ?? undefined,
            baseHp: r.base_hp,
            baseAtk: r.base_atk,
            memberExclusive: r.member_exclusive === true,
            setId: r.set_id,
          }));
        }
      : undefined,
    tcgConfigSource: botConfig ? () => botConfig.getTcgConfig() : undefined,
    cardBaseUrl: process.env.PUBLIC_BASE_URL ?? "",
    membershipTiersSource: botConfig ? () => botConfig.getMembershipTiers() : undefined,
    economyConfig: botConfig ? await botConfig.getEconomyConfig() : undefined,
    economyConfigSource: botConfig ? () => botConfig.getEconomyConfig() : undefined,
  });
  const client = createBotClient({
    config,
    registry: bot.registry,
    settings,
    cooldownStore,
    botGate: botConfig
      ? async () => ({
          off: !(await botConfig.getBotEnabled()),
          message: await botConfig.getMaintenanceMessage(),
        })
      : undefined,
  });
  await client.login(config.token);
  if (botConfig) {
    await botConfig.setRuntimeStatus({
      startedAt: new Date().toISOString(),
    });
  }
}

main().catch((err) => {
  console.error("[puni] shard failed to start", err);
  process.exit(1);
});
