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
}
