/** Runtime configuration from environment. Secrets come from the
 *  deployment environment / owner infra store — never from source code. */

export interface BotConfig {
  token: string;
  ownerDiscordId: string;
  mainGuildId: string;
  shopApiBaseUrl: string;
  shopBotKey: string;
  databaseUrl: string;
  redisUrl: string;
  /** "auto" or a fixed shard count (spec 2.5). */
  totalShards: number | "auto";
  /** Default prefix for a guild that has not configured one (spec 6.3). */
  defaultPrefix: string;
  /** AI chat provider (OpenAI-compatible). Empty apiKey = feature off. */
  ai: { apiKey: string; baseUrl: string; model: string };
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): BotConfig {
  const totalShardsRaw = env.TOTAL_SHARDS ?? "auto";
  const totalShards =
    totalShardsRaw === "auto" ? "auto" : Number.parseInt(totalShardsRaw, 10);
  if (totalShards !== "auto" && (!Number.isFinite(totalShards) || totalShards < 1)) {
    throw new Error(`Invalid TOTAL_SHARDS: ${totalShardsRaw}`);
  }
  return {
    token: env.DISCORD_BOT_TOKEN ?? "",
    ownerDiscordId: env.OWNER_DISCORD_ID ?? "",
    mainGuildId: env.MAIN_GUILD_ID ?? "1505404647924564091",
    shopApiBaseUrl: env.SHOP_API_BASE_URL ?? "https://bntshop.com/api/bot/v1",
    shopBotKey: env.SHOP_BOT_KEY ?? "",
    databaseUrl: env.DATABASE_URL ?? "",
    redisUrl: env.REDIS_URL ?? "",
    totalShards,
    defaultPrefix: "!",
    ai: {
      apiKey: env.AI_API_KEY ?? "",
      baseUrl: env.AI_API_BASE_URL ?? "https://api.openai.com/v1",
      model: env.AI_MODEL ?? "gpt-4o-mini",
    },
  };
}
