/**
 * PostgreSQL guild settings — production GuildSettingsProvider.
 * Reads merge the stored row over the defaults; writes upsert the full
 * settings object (the dashboard and Discord commands share this table).
 */
import type { Pool } from "pg";
import type { CommandModule } from "@puni/shared";
import type { GuildSettings, GuildSettingsProvider, ReactionOverride } from "../guild-settings";
import { normalizeCommunityConfig, type CommunityConfig } from "../community-config";
import {
  normalizeLogConfig,
  normalizeAutomodConfig,
  type LogConfig,
  type AutomodConfig,
} from "../moderation-config";
import { normalizeAiChatConfig, type AiChatConfig } from "../ai-config";

interface Row {
  guild_id: string;
  prefix: string;
  modules: Partial<Record<CommandModule, boolean>>;
  reaction_overrides: Record<string, ReactionOverride>;
  community: unknown;
  logging: unknown;
  automod: unknown;
  ai_chat: unknown;
}

export class PgGuildSettings implements GuildSettingsProvider {
  constructor(
    private pool: Pool,
    private defaultPrefix = "!",
  ) {}

  async get(guildId: string): Promise<GuildSettings> {
    const res = await this.pool.query<Row>(
      `SELECT guild_id, prefix, modules, reaction_overrides, community, logging, automod, ai_chat
       FROM guild_settings WHERE guild_id = $1`,
      [guildId],
    );
    if (!res.rows.length) {
      return {
        guildId,
        prefix: this.defaultPrefix,
        modules: {},
        reactionOverrides: {},
        community: normalizeCommunityConfig(undefined),
        logging: normalizeLogConfig(undefined),
        automod: normalizeAutomodConfig(undefined),
        aiChat: normalizeAiChatConfig(undefined),
      };
    }
    const row = res.rows[0];
    return {
      guildId: row.guild_id,
      prefix: row.prefix,
      modules: row.modules ?? {},
      reactionOverrides: row.reaction_overrides ?? {},
      community: normalizeCommunityConfig(row.community),
      logging: normalizeLogConfig(row.logging),
      automod: normalizeAutomodConfig(row.automod),
      aiChat: normalizeAiChatConfig(row.ai_chat),
    };
  }

  /** White label state (spec 6.25): config + last applied fingerprint. */
  async getBrandingState(guildId: string): Promise<{ branding: unknown; applied: string }> {
    const res = await this.pool.query<{ branding: unknown; branding_applied: string }>(
      `SELECT branding, branding_applied FROM guild_settings WHERE guild_id = $1`,
      [guildId],
    );
    if (!res.rows.length) return { branding: {}, applied: "" };
    return { branding: res.rows[0].branding ?? {}, applied: res.rows[0].branding_applied ?? "" };
  }

  async setBrandingApplied(guildId: string, fingerprint: string): Promise<void> {
    await this.pool.query(
      `UPDATE guild_settings SET branding_applied = $2 WHERE guild_id = $1`,
      [guildId, fingerprint],
    );
  }

  async set(guildId: string, patch: Partial<GuildSettings>): Promise<GuildSettings> {
    const current = await this.get(guildId);
    const next: GuildSettings = { ...current, ...patch, guildId };
    await this.pool.query(
      `INSERT INTO guild_settings (guild_id, prefix, modules, reaction_overrides, community, logging, automod, ai_chat, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (guild_id) DO UPDATE SET
         prefix = EXCLUDED.prefix,
         modules = EXCLUDED.modules,
         reaction_overrides = EXCLUDED.reaction_overrides,
         community = EXCLUDED.community,
         logging = EXCLUDED.logging,
         automod = EXCLUDED.automod,
         ai_chat = EXCLUDED.ai_chat,
         updated_at = now()`,
      [
        guildId,
        next.prefix,
        JSON.stringify(next.modules),
        JSON.stringify(next.reactionOverrides),
        JSON.stringify(next.community satisfies CommunityConfig),
        JSON.stringify(next.logging satisfies LogConfig),
        JSON.stringify(next.automod satisfies AutomodConfig),
        JSON.stringify(next.aiChat satisfies AiChatConfig),
      ],
    );
    return next;
  }
}
