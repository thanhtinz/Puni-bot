import type { Pool } from "pg";
import type { CommandModule } from "@puni/shared";
import type { GuildSettings, GuildSettingsProvider } from "../guild-settings";

interface GuildRow {
  guild_id: string;
  prefix: string;
  modules: Partial<Record<CommandModule, boolean>> | null;
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
      `SELECT guild_id, prefix, modules FROM guild_settings WHERE guild_id = $1`,
      [guildId],
    );
    const row = res.rows[0];
    if (!row) {
      return { guildId, prefix: this.defaultPrefix, modules: {} };
    }
    return {
      guildId: row.guild_id,
      prefix: row.prefix || this.defaultPrefix,
      modules: row.modules ?? {},
    };
  }
}
