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

interface Row {
  guild_id: string;
  prefix: string;
  shop_enabled: boolean;
  modules: Partial<Record<CommandModule, boolean>>;
  reaction_overrides: Record<string, ReactionOverride>;
  community: unknown;
  logging: unknown;
  automod: unknown;
}

export class PgGuildSettings implements GuildSettingsProvider {
  constructor(
    private pool: Pool,
    private defaultPrefix = "!",
  ) {}

  async get(guildId: string): Promise<GuildSettings> {
    const res = await this.pool.query<Row>(
      `SELECT guild_id, prefix, shop_enabled, modules, reaction_overrides, community, logging, automod
       FROM guild_settings WHERE guild_id = $1`,
      [guildId],
    );
    if (!res.rows.length) {
      return {
        guildId,
        prefix: this.defaultPrefix,
        shopEnabled: false,
        modules: {},
        reactionOverrides: {},
        community: normalizeCommunityConfig(undefined),
        logging: normalizeLogConfig(undefined),
        automod: normalizeAutomodConfig(undefined),
      };
    }
    const row = res.rows[0];
    return {
      guildId: row.guild_id,
      prefix: row.prefix,
      shopEnabled: row.shop_enabled,
      modules: row.modules ?? {},
      reactionOverrides: row.reaction_overrides ?? {},
      community: normalizeCommunityConfig(row.community),
      logging: normalizeLogConfig(row.logging),
      automod: normalizeAutomodConfig(row.automod),
    };
  }

  async set(guildId: string, patch: Partial<GuildSettings>): Promise<GuildSettings> {
    const current = await this.get(guildId);
    const next: GuildSettings = { ...current, ...patch, guildId };
    await this.pool.query(
      `INSERT INTO guild_settings (guild_id, prefix, shop_enabled, modules, reaction_overrides, community, logging, automod, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
       ON CONFLICT (guild_id) DO UPDATE SET
         prefix = EXCLUDED.prefix,
         shop_enabled = EXCLUDED.shop_enabled,
         modules = EXCLUDED.modules,
         reaction_overrides = EXCLUDED.reaction_overrides,
         community = EXCLUDED.community,
         logging = EXCLUDED.logging,
         automod = EXCLUDED.automod,
         updated_at = now()`,
      [
        guildId,
        next.prefix,
        next.shopEnabled,
        JSON.stringify(next.modules),
        JSON.stringify(next.reactionOverrides),
        JSON.stringify(next.community satisfies CommunityConfig),
        JSON.stringify(next.logging satisfies LogConfig),
        JSON.stringify(next.automod satisfies AutomodConfig),
      ],
    );
    return next;
  }
}
