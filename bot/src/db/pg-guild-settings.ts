import type { Pool } from "pg";
import type { CommandModule } from "@puni/shared";
import { normalizeAiChatConfig } from "../ai-config";
import type { GuildSettings, GuildSettingsProvider, ReactionOverride } from "../guild-settings";

interface GuildRow {
  guild_id: string;
  prefix: string;
  modules: Partial<Record<CommandModule, boolean>> | null;
  reaction_overrides: Record<string, ReactionOverride> | null;
  ai_chat: unknown;
}

/** PostgreSQL GuildSettingsProvider — reads prefix + module switches
 *  from the shared guild_settings row (other columns are legacy). */
export class PgGuildSettings implements GuildSettingsProvider {
  constructor(
    private pool: Pool,
    private defaultPrefix = "!",
  ) {}

  async get(guildId: string): Promise<GuildSettings> {
    const res = await this.pool.query<GuildRow>(
      `SELECT guild_id, prefix, modules, reaction_overrides, ai_chat FROM guild_settings WHERE guild_id = $1`,
      [guildId],
    );
    const row = res.rows[0];
    if (!row) {
      return {
        guildId, prefix: this.defaultPrefix, modules: {},
        reactionOverrides: {}, aiChat: normalizeAiChatConfig(undefined),
      };
    }
    return {
      guildId: row.guild_id,
      prefix: row.prefix || this.defaultPrefix,
      modules: row.modules ?? {},
      reactionOverrides: row.reaction_overrides ?? {},
      aiChat: normalizeAiChatConfig(row.ai_chat),
    };
  }
}
