/**
 * Per-guild settings — one source of truth shared by Discord commands and
 * the dashboard (spec: "luật cấu hình hai nơi"). The database-backed
 * provider lands with the DB layer; this in-memory provider keeps the
 * exact same interface so callers never change.
 */
import type { CommandModule } from "@puni/shared";
import {
  normalizeCommunityConfig,
  type CommunityConfig,
} from "./community-config";

export interface ReactionOverride {
  enabled?: boolean;
  tagText?: string;
  soloText?: string;
  cooldownSec?: number;
}

export interface GuildSettings {
  guildId: string;
  /** Prefix for this guild (spec 6.3). Default "!". */
  prefix: string;
  /** Shop module master switch. When false, the hidden-shop law applies:
   *  no shop UI anywhere and shop commands behave as if they do not exist. */
  shopEnabled: boolean;
  /** Per-module switches; missing = enabled (except shop, gated above). */
  modules: Partial<Record<CommandModule, boolean>>;
  reactionOverrides: Record<string, ReactionOverride>;
  /** Community features: welcome/goodbye/boost (spec 6.5). */
  community: CommunityConfig;
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
      s = {
        guildId,
        prefix: this.defaultPrefix,
        shopEnabled: false,
        modules: {},
        reactionOverrides: {},
        community: normalizeCommunityConfig(undefined),
      };
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
