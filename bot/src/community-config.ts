/**
 * Community feature configuration per guild — spec 6.5 (welcome /
 * goodbye / boost messages). Stored as one JSONB document on
 * guild_settings; edited identically from Discord commands and the
 * dashboard (two-surface law). Templates support the placeholders
 * {user} {username} {server} {count}.
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
    message: "Cảm ơn {user} đã boost cho **{server}**!",
  },
};

/** Deep-merge a stored (possibly partial/legacy) document over defaults. */
export function normalizeCommunityConfig(raw: unknown): CommunityConfig {
  const base = structuredClone(DEFAULT_COMMUNITY_CONFIG);
  if (!raw || typeof raw !== "object") return base;
  const doc = raw as Partial<Record<keyof CommunityConfig, Partial<GreetingConfig>>>;
  for (const key of ["welcome", "goodbye", "boost"] as const) {
    const part = doc[key];
    if (part && typeof part === "object") {
      if (typeof part.enabled === "boolean") base[key].enabled = part.enabled;
      if (typeof part.channelId === "string" || part.channelId === null) base[key].channelId = part.channelId;
      if (typeof part.message === "string" && part.message.length > 0) base[key].message = part.message;
    }
  }
  return base;
}

export function renderTemplate(
  template: string,
  vars: { user: string; username: string; server: string; count: number },
): string {
  return template
    .replaceAll("{user}", vars.user)
    .replaceAll("{username}", vars.username)
    .replaceAll("{server}", vars.server)
    .replaceAll("{count}", String(vars.count));
}
