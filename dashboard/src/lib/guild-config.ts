/**
 * Web-side mirror of the bot's per-guild config shapes
 * (bot/src/community-config.ts + moderation-config.ts). The stored
 * JSON in guild_settings is the contract; both sides normalize over
 * the same defaults so a value written here is read identically by
 * the bot, and vice versa.
 */

export interface GreetingConfig {
  enabled: boolean;
  channelId: string | null;
  message: string;
}

export interface CommunityConfig {
  welcome: GreetingConfig;
  goodbye: GreetingConfig;
  boost: GreetingConfig;
}

export const DEFAULT_COMMUNITY_CONFIG: CommunityConfig = {
  welcome: {
    enabled: false,
    channelId: null,
    message: "Chào mừng {user} đến với **{server}**! Bạn là thành viên thứ {count}.",
  },
  goodbye: {
    enabled: false,
    channelId: null,
    message: "{username} đã rời khỏi **{server}**. Server còn {count} thành viên.",
  },
  boost: {
    enabled: false,
    channelId: null,
    message: "{user} vừa boost cho **{server}**! Cảm ơn bạn rất nhiều.",
  },
};

function normGreeting(raw: unknown, fallback: GreetingConfig): GreetingConfig {
  if (!raw || typeof raw !== "object") return { ...fallback };
  const r = raw as Partial<GreetingConfig>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : fallback.enabled,
    channelId: typeof r.channelId === "string" && r.channelId ? r.channelId : null,
    message: typeof r.message === "string" && r.message.trim() ? r.message : fallback.message,
  };
}

export function normalizeCommunityConfig(raw: unknown): CommunityConfig {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_COMMUNITY_CONFIG);
  const r = raw as Partial<CommunityConfig>;
  return {
    welcome: normGreeting(r.welcome, DEFAULT_COMMUNITY_CONFIG.welcome),
    goodbye: normGreeting(r.goodbye, DEFAULT_COMMUNITY_CONFIG.goodbye),
    boost: normGreeting(r.boost, DEFAULT_COMMUNITY_CONFIG.boost),
  };
}

export const LOG_GROUPS = ["messages", "members", "server", "moderation", "channels"] as const;
export type LogGroup = (typeof LOG_GROUPS)[number];

export const LOG_GROUP_LABELS: Record<LogGroup, string> = {
  messages: "Tin nhắn (xoá / sửa)",
  members: "Thành viên (vào / ra)",
  server: "Server (đổi tên, role…)",
  moderation: "Kiểm duyệt (case, ban, mute…)",
  channels: "Kênh (tạo / xoá)",
};

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
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_LOG_CONFIG);
  const r = raw as Partial<LogConfig> & { groups?: Partial<Record<LogGroup, boolean>> };
  const groups = { ...DEFAULT_LOG_CONFIG.groups };
  for (const g of LOG_GROUPS) {
    if (typeof r.groups?.[g] === "boolean") groups[g] = r.groups[g] as boolean;
  }
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : false,
    channelId: typeof r.channelId === "string" && r.channelId ? r.channelId : null,
    groups,
  };
}

export interface AutomodConfig {
  enabled: boolean;
  blockedWords: string[];
  blockLinks: boolean;
  capsRatio: number;
  capsMinLength: number;
  warnOnDelete: boolean;
}

export const DEFAULT_AUTOMOD_CONFIG: AutomodConfig = {
  enabled: false,
  blockedWords: [],
  blockLinks: false,
  capsRatio: 0,
  capsMinLength: 10,
  warnOnDelete: false,
};

export function normalizeAutomodConfig(raw: unknown): AutomodConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AUTOMOD_CONFIG };
  const r = raw as Partial<AutomodConfig>;
  return {
    enabled: typeof r.enabled === "boolean" ? r.enabled : false,
    blockedWords: Array.isArray(r.blockedWords)
      ? r.blockedWords.filter((w): w is string => typeof w === "string").slice(0, 200)
      : [],
    blockLinks: typeof r.blockLinks === "boolean" ? r.blockLinks : false,
    capsRatio:
      typeof r.capsRatio === "number" && r.capsRatio >= 0 && r.capsRatio <= 1 ? r.capsRatio : 0,
    capsMinLength:
      typeof r.capsMinLength === "number" && r.capsMinLength >= 1 ? Math.floor(r.capsMinLength) : 10,
    warnOnDelete: typeof r.warnOnDelete === "boolean" ? r.warnOnDelete : false,
  };
}

/** Parse a submitted settings form (checkboxes arrive as "on"). */
export function formBool(form: FormData, name: string): boolean {
  return form.get(name) === "on" || form.get(name) === "true";
}

export function formChannelId(form: FormData, name: string): string | null {
  const v = String(form.get(name) ?? "").trim();
  return /^\d{5,25}$/.test(v) ? v : null;
}

export function formText(form: FormData, name: string, max = 1000): string {
  return String(form.get(name) ?? "").slice(0, max);
}
