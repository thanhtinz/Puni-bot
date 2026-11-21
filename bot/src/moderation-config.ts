/**
 * Logging + automod configuration per guild — spec 6.6/6.7.
 * Stored as JSONB documents on guild_settings; edited from Discord
 * commands and the dashboard alike (two-surface law).
 */

export type LogGroup = "messages" | "members" | "server" | "moderation" | "channels";
export const LOG_GROUPS: LogGroup[] = ["messages", "members", "server", "moderation", "channels"];

export interface LogConfig {
  enabled: boolean;
  channelId: string | null;
  groups: Record<LogGroup, boolean>;
}

export const DEFAULT_LOG_CONFIG: LogConfig = {
  enabled: false,
  channelId: null,
  groups: { messages: true, members: true, server: true, moderation: true, channels: true },
};

export function normalizeLogConfig(raw: unknown): LogConfig {
  const base = structuredClone(DEFAULT_LOG_CONFIG);
  if (!raw || typeof raw !== "object") return base;
  const doc = raw as Partial<LogConfig> & { groups?: Partial<Record<LogGroup, boolean>> };
  if (typeof doc.enabled === "boolean") base.enabled = doc.enabled;
  if (typeof doc.channelId === "string" || doc.channelId === null) base.channelId = doc.channelId;
  if (doc.groups && typeof doc.groups === "object") {
    for (const g of LOG_GROUPS) {
      if (typeof doc.groups[g] === "boolean") base.groups[g] = doc.groups[g] as boolean;
    }
  }
  return base;
}

export interface AutomodConfig {
  enabled: boolean;
  /** Case-insensitive substrings that get a message deleted. */
  blockedWords: string[];
  /** Delete messages containing http(s) links. */
  blockLinks: boolean;
  /** Delete when uppercase ratio exceeds this (0..1) on messages of at
   *  least capsMinLength characters. 0 disables the caps rule. */
  capsRatio: number;
  capsMinLength: number;
  /** Also create a warn case when automod deletes a message. */
  warnOnDelete: boolean;
}

export const DEFAULT_AUTOMOD_CONFIG: AutomodConfig = {
  enabled: false,
  blockedWords: [],
  blockLinks: false,
  capsRatio: 0,
  capsMinLength: 12,
  warnOnDelete: false,
};

export function normalizeAutomodConfig(raw: unknown): AutomodConfig {
  const base = structuredClone(DEFAULT_AUTOMOD_CONFIG);
  if (!raw || typeof raw !== "object") return base;
  const doc = raw as Partial<AutomodConfig>;
  if (typeof doc.enabled === "boolean") base.enabled = doc.enabled;
  if (Array.isArray(doc.blockedWords)) {
    base.blockedWords = doc.blockedWords.filter((w): w is string => typeof w === "string").slice(0, 200);
  }
  if (typeof doc.blockLinks === "boolean") base.blockLinks = doc.blockLinks;
  if (typeof doc.capsRatio === "number" && doc.capsRatio >= 0 && doc.capsRatio <= 1) base.capsRatio = doc.capsRatio;
  if (typeof doc.capsMinLength === "number" && doc.capsMinLength >= 1) base.capsMinLength = Math.floor(doc.capsMinLength);
  if (typeof doc.warnOnDelete === "boolean") base.warnOnDelete = doc.warnOnDelete;
  return base;
}
