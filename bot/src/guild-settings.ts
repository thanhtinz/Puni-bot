/**
 * Per-guild settings. Since the pivot (spec 6.28) the bot is a pure
 * game bot — the only per-guild settings left are the command prefix
 * and per-module switches. The guild_settings table keeps its other
 * columns in the DB, unused.
 */
import type { CommandModule } from "@puni/shared";

export interface GuildSettings {
  guildId: string;
  /** Prefix for this guild. Default "!". */
  prefix: string;
  /** Per-module switches; missing = enabled. */
  modules: Partial<Record<CommandModule, boolean>>;
}

export interface GuildSettingsProvider {
  get(guildId: string): Promise<GuildSettings>;
}

export class InMemoryGuildSettings implements GuildSettingsProvider {
  private store = new Map<string, GuildSettings>();

  constructor(private defaultPrefix = "!") {}

  async get(guildId: string): Promise<GuildSettings> {
    let s = this.store.get(guildId);
    if (!s) {
      s = { guildId, prefix: this.defaultPrefix, modules: {} };
      this.store.set(guildId, s);
    }
    return s;
  }

  async set(guildId: string, patch: Partial<GuildSettings>): Promise<GuildSettings> {
    const s = await this.get(guildId);
    Object.assign(s, patch, { guildId });
    return s;
  }
}
