/**
 * AI chat configuration per guild — when someone @mentions Puni, the bot
 * answers in its cute cat persona (spec: AI chat). Stored as one JSONB
 * document on guild_settings; edited identically from Discord commands
 * and the dashboard (two-surface law).
 *
 * The feature only runs when the bot deployment has an AI provider key
 * (AI_API_KEY); this per-guild switch is the second gate so a server can
 * opt out even when the provider is configured globally.
 */

export interface AiChatConfig {
  enabled: boolean;
}

export const DEFAULT_AI_CHAT_CONFIG: AiChatConfig = { enabled: true };

export function normalizeAiChatConfig(raw: unknown): AiChatConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_AI_CHAT_CONFIG };
  const doc = raw as Partial<AiChatConfig>;
  return { enabled: typeof doc.enabled === "boolean" ? doc.enabled : DEFAULT_AI_CHAT_CONFIG.enabled };
}
