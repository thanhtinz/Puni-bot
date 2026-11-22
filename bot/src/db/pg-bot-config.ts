import type { Pool } from "pg";
import {
  DEFAULT_ECONOMY_CONFIG,
  normalizeEconomyConfig,
  type EconomyConfig,
} from "../services/economy";

/**
 * Reads the owner-edited global config (bot_config, migration 0009) with
 * a short in-process cache, so Admin panel edits take effect live
 * without hammering the database on every command. Any failure (table
 * missing, DB hiccup) falls back to the built-in defaults — config can
 * never take the bot down.
 */
export class PgBotConfig {
  private cache = new Map<string, { value: unknown; at: number }>();

  constructor(
    private pool: Pool,
    private ttlMs = 30_000,
  ) {}

  private async get(key: string): Promise<unknown> {
    const hit = this.cache.get(key);
    if (hit && Date.now() - hit.at < this.ttlMs) return hit.value;
    let value: unknown = null;
    try {
      const res = await this.pool.query<{ value: unknown }>(
        `SELECT value FROM bot_config WHERE key = $1`,
        [key],
      );
      value = res.rows[0]?.value ?? null;
    } catch {
      value = null;
    }
    this.cache.set(key, { value, at: Date.now() });
    return value;
  }

  async getEconomyConfig(): Promise<EconomyConfig> {
    const raw = await this.get("economy");
    return raw == null ? { ...DEFAULT_ECONOMY_CONFIG } : normalizeEconomyConfig(raw);
  }

  /** AI chat master switch (Admin panel). Default: enabled. */
  async getAiEnabled(): Promise<boolean> {
    const raw = await this.get("ai_enabled");
    return raw !== false;
  }

  /** Membership tier definitions (Admin panel → Membership). */
  async getMembershipTiers(): Promise<import("../services/membership").MembershipTier[]> {
    const { normalizeMembershipTiers } = await import("../services/membership");
    return normalizeMembershipTiers(await this.get("membership_tiers"));
  }

  /** Discord role id granted to active members in the main guild
   *  (Admin panel → Membership). Empty = role perk off. */
  async getMembershipRoleId(): Promise<string> {
    const raw = await this.get("membership_role_id");
    return typeof raw === "string" && /^\d{5,25}$/.test(raw) ? raw : "";
  }

  /** TCG config (spec 6.23). */
  async getTcgConfig(): Promise<import("../services/tcg").TcgConfig> {
    const { normalizeTcgConfig } = await import("../services/tcg");
    return normalizeTcgConfig(await this.get("tcg_config"));
  }

  /** Marriage ring tiers (spec 6.16.5); owner-editable prices. */
  async getRingTiers(): Promise<import("../services/marriage").RingTier[]> {
    const { normalizeRingTiers } = await import("../services/marriage");
    return normalizeRingTiers(await this.get("marriage_rings"));
  }

  /** Global bot on/off switch (Admin panel → Vận hành). Default: on.
   *  When off, the dispatcher answers every non-owner command with the
   *  maintenance message and AI chat stays silent. */
  async getBotEnabled(): Promise<boolean> {
    const raw = await this.get("bot_enabled");
    return raw !== false;
  }

  /** Reply shown while the bot is switched off. */
  async getMaintenanceMessage(): Promise<string> {
    const raw = await this.get("maintenance_message");
    if (typeof raw === "string" && raw.trim() !== "") return raw.trim().slice(0, 200);
    return "Puni đang bảo trì một chút, bạn quay lại sau nhé!";
  }

  /** AI model override from the Admin panel; null = use the env model. */
  async getAiModel(): Promise<string | null> {
    const raw = await this.get("ai_model");
    return typeof raw === "string" && raw.trim() !== "" ? raw.trim().slice(0, 80) : null;
  }

  /** Extra persona instructions from the Admin panel ("" = none). */
  async getAiPersonaExtra(): Promise<string> {
    const raw = await this.get("ai_persona_extra");
    return typeof raw === "string" ? raw.slice(0, 1000) : "";
  }

  /** The shard writes its runtime status at startup so the Admin panel
   *  can show facts only the bot process knows (AI key configured…). */
  async setRuntimeStatus(status: Record<string, unknown>): Promise<void> {
    try {
      await this.pool.query(
        `INSERT INTO bot_config (key, value, updated_at) VALUES ('runtime_status', $1::jsonb, now())
         ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
        [JSON.stringify(status)],
      );
    } catch {
      /* status reporting must never take the bot down */
    }
  }
}
