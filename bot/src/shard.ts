/** Shard worker entry — spawned by the launcher (index.ts), one process
 *  per shard (spec 2.5). All state lives in shared stores, never in this
 *  process, so shards are disposable workers.
 *
 *  With DATABASE_URL set, state is PostgreSQL (production). Without it,
 *  the shard falls back to in-memory stores with a loud warning — data
 *  will not survive a restart in that mode.
 *
 *  Scope (owner correction 2026-11-21 23:59): only SERVER-MANAGEMENT
 *  wiring was removed (moderation cases, branding sync). The game and
 *  fun surface stays wired: TCG, economy, marriage, reactions, vote,
 *  AI chat and the membership role perk. */
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
  let voteStore: import("./services/vote").VoteStore | undefined;
  let gameSessionStore: import("./services/game-sessions").GameSessionStore | undefined;
  let channelGameStore: import("./services/channel-games").ChannelGameStore | undefined;
  let membershipOrders: import("./services/membership").MembershipOrderStore | undefined;
  let marriageStore: import("./services/marriage").MarriageStore | undefined;
  let tcgStore: import("./services/tcg-store").TcgStore | undefined;
  let formatStore: import("./services/tcg-formats").FormatStore | undefined;
  let questStore: import("./services/tcg-quests").QuestStore | undefined;
  let socialStore: import("./services/tcg-social").SocialStore | undefined;
  let werewolfStore: import("./services/werewolf-store").WerewolfStore | undefined;
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
    const { PgGameSessionStore } = await import("./db/pg-game-sessions");
    gameSessionStore = new PgGameSessionStore(pool);
    const { PgChannelGameStore } = await import("./db/pg-channel-games");
    channelGameStore = new PgChannelGameStore(pool);
    const { PgVoteStore } = await import("./db/pg-vote-store");
    voteStore = new PgVoteStore(pool);
    const { PgMarriageStore } = await import("./db/pg-marriage-store");
    marriageStore = new PgMarriageStore(pool);
    const { PgTcgStore } = await import("./db/pg-tcg-store");
    tcgStore = new PgTcgStore(pool);
    const { PgFormatStore } = await import("./db/pg-tcg-formats");
    formatStore = new PgFormatStore(pool);
    const { PgQuestStore } = await import("./db/pg-tcg-quests");
    questStore = new PgQuestStore(pool);
    const { PgSocialStore } = await import("./db/pg-tcg-social");
    socialStore = new PgSocialStore(pool);
    const { PgWerewolfStore } = await import("./db/pg-werewolf");
    werewolfStore = new PgWerewolfStore(pool);
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
        modelSource: botConfig ? () => botConfig.getAiModel() : undefined,
      }),
      {
        cooldownStore,
        personaExtraSource: botConfig ? () => botConfig.getAiPersonaExtra() : undefined,
      },
    );
    console.log(`[puni] ai chat: on (model ${config.ai.model})`);
  }

  let discordClient: { user: { id: string } | null } | undefined;
  const bot = buildBot({
    settings,
    economyStore,
    membershipStore,
    membershipOrders,
    marriageStore,
    ringTiersSource: botConfig ? () => botConfig.getRingTiers() : undefined,
    tcgStore,
    formatStore,
    questStore,
    socialStore,
    tcgCatalogSource: pgPool
      ? async () => {
          const res = await pgPool!.query<{ id: string; name: string; rarity: string; evolves_to: string | null; base_hp: number; base_atk: number; member_exclusive: boolean; set_id: string; price_usd: string | null; market_price_coins: string | null }>(
            `SELECT id, name, rarity, evolves_to, base_hp, base_atk, member_exclusive, set_id, price_usd, market_price_coins FROM game_species WHERE enabled = true`,
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
            priceUsd: r.price_usd != null ? Number(r.price_usd) : undefined,
            marketPriceCoins: r.market_price_coins != null ? Number(r.market_price_coins) : undefined,
          }));
        }
      : undefined,
    tcgConfigSource: botConfig ? () => botConfig.getTcgConfig() : undefined,
    cardBaseUrl: process.env.PUBLIC_BASE_URL ?? "",
    gameSessionStore,
    channelGameStore,
    werewolfStore,
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
    channelGames: channelGameStore
      ? new (await import("./services/channel-games")).ChannelGamesService(channelGameStore)
      : undefined,
    aiChat,
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

  // Werewolf tick (spec 6.16.4): every 5s, advance games whose
  // phase deadline passed and deliver queued announcements (role
  // DMs + phase posts) from the outbox. State lives in the store,
  // so every shard may run this; the outbox claim + the game's
  // saved deadline keep each step exactly-once.
  {
    const { advanceIfDue } = await import("./services/werewolf");
    const wwTick = async () => {
      try {
        const cfg = await bot.werewolfConfig();
        const due = await bot.werewolf.listDue(Date.now(), 10);
        for (const game of due) {
          const adv = advanceIfDue(game, cfg, Date.now());
          if (!adv.advanced) continue;
          await bot.werewolf.save(game);
          if (adv.fx.finished && (await bot.werewolf.claimStats(game.id))) {
            await bot.werewolf.recordResult(game.guildId, adv.fx.finished.winner, adv.fx.finished.players);
          }
          if (adv.fx.announcements.length) await bot.werewolf.enqueue(adv.fx.announcements);
        }
        const items = await bot.werewolf.drainOutbox(20);
        for (const item of items) {
          try {
            // Role-card art (spec 6.16.4): an item may name a file
            // under assets/werewolf/ — attach it to the delivery
            // (the secret role DM shows the player's role card).
            const files = item.art
              ? [{ attachment: path.resolve(__dirname, "../../assets/werewolf", item.art), name: item.art }]
              : undefined;
            if (item.kind === "channel") {
              const ch = await client.channels.fetch(item.targetId).catch(() => null);
              if (ch && "send" in ch) {
                await (ch as { send: (o: object) => Promise<unknown> }).send({
                  content: item.text,
                  ...(files ? { files } : {}),
                  allowedMentions: { parse: [] },
                });
              }
            } else {
              const user = await client.users.fetch(item.targetId).catch(() => null);
              if (user) await user.send({ content: item.text, ...(files ? { files } : {}), allowedMentions: { parse: [] } });
            }
            await bot.werewolf.ackOutbox(item.id);
          } catch {
            // Leave the item claimed; its lease expires in 60s and
            // another tick retries (e.g. the user has DMs closed).
          }
        }
      } catch (err) {
        console.warn("[puni] werewolf tick failed", err);
      }
    };
    setInterval(() => void wwTick(), 5_000);
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
          console.log(`[puni] membership roles synced: +${diff.grant.length} -${diff.revoke.length}`);
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
