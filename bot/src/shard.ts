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
import { PgBotConfig } from "./db/pg-bot-config";
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
  let botConfig: PgBotConfig | undefined;
  let membershipStore: import("./services/membership").MembershipStore | undefined;
  let membershipOrders: import("./services/membership").MembershipOrderStore | undefined;
  let voteStore: import("./services/vote").VoteStore | undefined;
  let discordClient: { user: { id: string } | null } | undefined;
  let pgPool: Pool | undefined;
  if (config.databaseUrl) {
    const pool = new Pool({ connectionString: config.databaseUrl });
    pgPool = pool;
    const applied = await runMigrations(pool, path.resolve(__dirname, "../../db/migrations"));
    if (applied.length) console.log(`[puni] migrations applied: ${applied.join(", ")}`);
    settings = new PgGuildSettings(pool, config.defaultPrefix);
    economyStore = new PgEconomyStore(pool);
    caseStore = new PgModCaseStore(pool);
    botConfig = new PgBotConfig(pool);
    const { PgMembershipStore } = await import("./db/pg-membership-store");
    membershipStore = new PgMembershipStore(pool);
    const { PgMembershipOrderStore } = await import("./db/pg-membership-orders");
    membershipOrders = new PgMembershipOrderStore(pool);
    const { PgVoteStore } = await import("./db/pg-vote-store");
    voteStore = new PgVoteStore(pool);
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

  const bot = buildBot({
    settings,
    economyStore,
    caseStore,
    membershipStore,
    membershipOrders,
    voteStore,
    voteConfigSource: botConfig ? () => botConfig.getVoteConfig() : undefined,
    voteBotIdSource: () => discordClient?.user?.id ?? process.env.DISCORD_CLIENT_ID ?? null,
    membershipTiersSource: botConfig ? () => botConfig.getMembershipTiers() : undefined,
    economyConfig: botConfig ? await botConfig.getEconomyConfig() : undefined,
    economyConfigSource: botConfig ? () => botConfig.getEconomyConfig() : undefined,
  });
  const client = createBotClient({
    config,
    registry: bot.registry,
    settings,
    cooldownStore,
    enforcer: bot.enforcer,
    cases: bot.cases,
    addCaseHook: bot.addCaseHook,
    aiChat,
    // AI chat obeys BOTH its own master switch and the global bot switch.
    aiGloballyEnabled: botConfig
      ? async () => (await botConfig.getAiEnabled()) && (await botConfig.getBotEnabled())
      : undefined,
    botGate: botConfig
      ? async () => ({
          off: !(await botConfig.getBotEnabled()),
          message: await botConfig.getMaintenanceMessage(),
        })
      : undefined,
  });
  discordClient = client;
  await client.login(config.token);
  if (botConfig) {
    await botConfig.setRuntimeStatus({
      startedAt: new Date().toISOString(),
      aiConfigured: Boolean(config.ai.apiKey),
      aiEnvModel: config.ai.model,
    });
  }

  // Membership role sync (spec 6.19): active members hold the member
  // role in the main guild; expired members lose it. Runs at startup
  // and every 10 minutes; every step is best-effort and logged.
  if (botConfig && bot.membership && config.mainGuildId) {
    const syncRoles = async () => {
      try {
        const roleId = await botConfig.getMembershipRoleId();
        if (!roleId) return;
        const guild = await client.guilds.fetch(config.mainGuildId);
        const role = await guild.roles.fetch(roleId).catch(() => null);
        if (!role) return;
        await guild.members.fetch();
        const holders = new Set(role.members.map((m) => m.id));
        const now = new Date();
        const all = await bot.membership.listAll();
        const active = new Set(
          all.filter((r) => r.expiresAt.getTime() > now.getTime()).map((r) => r.userId),
        );
        const { computeRoleDiff } = await import("./services/membership-roles");
        const diff = computeRoleDiff(active, holders);
        for (const userId of diff.grant) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) await member.roles.add(roleId).catch(() => undefined);
        }
        for (const userId of diff.revoke) {
          const member = await guild.members.fetch(userId).catch(() => null);
          if (member) await member.roles.remove(roleId).catch(() => undefined);
        }
        if (diff.grant.length || diff.revoke.length) {
          console.log(
            `[puni] membership roles synced: +${diff.grant.length} -${diff.revoke.length}`,
          );
        }
      } catch (err) {
        console.warn("[puni] membership role sync failed", err);
      }
    };
    void syncRoles();
    setInterval(() => void syncRoles(), 10 * 60 * 1000);
  }
}

main().catch((err) => {
  console.error("[puni] shard failed to start", err);
  process.exit(1);
});
