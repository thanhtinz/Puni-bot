/**
 * White label branding (spec 6.25): per-guild nickname + guild
 * member avatar the bot wears inside one guild. Config lives in
 * guild_settings.branding (written by the server dashboard); the
 * bot applies it through the Discord REST "modify current member"
 * endpoint and records a fingerprint in branding_applied so it only
 * calls the API when the config actually changed.
 */
import { createHash } from "node:crypto";

export interface BrandingConfig {
  nickname: string;
  avatarDataUri: string;
}

export const DEFAULT_BRANDING: BrandingConfig = { nickname: "", avatarDataUri: "" };
export const AVATAR_DATA_URI_MAX = 280_000;

/** Mirror of the dashboard's normalizeBranding — same JSONB contract. */
export function normalizeBranding(raw: unknown): BrandingConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_BRANDING };
  const r = raw as Partial<BrandingConfig>;
  const nickname = typeof r.nickname === "string" ? r.nickname.trim().slice(0, 32) : "";
  const avatar =
    typeof r.avatarDataUri === "string" &&
    r.avatarDataUri.startsWith("data:image/") &&
    r.avatarDataUri.length <= AVATAR_DATA_URI_MAX
      ? r.avatarDataUri
      : "";
  return { nickname, avatarDataUri: avatar };
}

export function brandingFingerprint(cfg: BrandingConfig): string {
  return createHash("sha256").update(cfg.nickname).update("\n").update(cfg.avatarDataUri).digest("hex");
}

export function brandingIsDefault(cfg: BrandingConfig): boolean {
  return cfg.nickname === "" && cfg.avatarDataUri === "";
}

interface RestLike {
  patch(route: string, options: { body: unknown }): Promise<unknown>;
}

/**
 * Apply branding to the bot's member profile in one guild.
 * Empty nickname/avatar reset to the app's defaults (null).
 */
export async function applyBranding(rest: RestLike, guildId: string, cfg: BrandingConfig): Promise<void> {
  await rest.patch(`/guilds/${guildId}/members/@me`, {
    body: {
      nick: cfg.nickname === "" ? null : cfg.nickname,
      avatar: cfg.avatarDataUri === "" ? null : cfg.avatarDataUri,
    },
  });
}
