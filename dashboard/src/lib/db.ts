/**
 * PostgreSQL access for the dashboard — the SAME database the bot
 * uses. guild_settings is the single source of truth shared by the
 * Discord commands and this dashboard (two-surface config law).
 */
import { Pool } from "pg";

let pool: Pool | null = null;

export function db(): Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL || "";
    if (!url) throw new Error("DATABASE_URL chưa cấu hình cho dashboard.");
    pool = new Pool({ connectionString: url, max: 5 });
  }
  return pool;
}

export interface GuildRow {
  guild_id: string;
  prefix: string;
  modules: Record<string, boolean>;
  community: unknown;
  logging: unknown;
  automod: unknown;
  ai_chat: unknown;
}

export async function getGuildRow(guildId: string): Promise<GuildRow | null> {
  const res = await db().query<GuildRow>(
    `SELECT guild_id, prefix, modules, community, logging, automod, ai_chat
     FROM guild_settings WHERE guild_id = $1`,
    [guildId],
  );
  return res.rows[0] ?? null;
}

/** Upsert one settings section, preserving every other column —
 *  mirrors the bot's PgGuildSettings.set merge semantics. */
export async function saveGuildSection(
  guildId: string,
  patch: Partial<{
    prefix: string;
    community: unknown;
    logging: unknown;
    automod: unknown;
    aiChat: unknown;
    modules: Record<string, boolean>;
  }>,
): Promise<void> {
  const current = await getGuildRow(guildId);
  const next = {
    prefix: patch.prefix ?? current?.prefix ?? "!",
    modules: patch.modules ?? current?.modules ?? {},
    community: patch.community ?? current?.community ?? {},
    logging: patch.logging ?? current?.logging ?? {},
    automod: patch.automod ?? current?.automod ?? {},
    ai_chat: patch.aiChat ?? current?.ai_chat ?? {},
  };
  await db().query(
    `INSERT INTO guild_settings (guild_id, prefix, modules, reaction_overrides, community, logging, automod, ai_chat, updated_at)
     VALUES ($1, $2, $3, '{}'::jsonb, $4, $5, $6, $7, now())
     ON CONFLICT (guild_id) DO UPDATE SET
       prefix = EXCLUDED.prefix,
       modules = EXCLUDED.modules,
       community = EXCLUDED.community,
       logging = EXCLUDED.logging,
       automod = EXCLUDED.automod,
       ai_chat = EXCLUDED.ai_chat,
       updated_at = now()`,
    [
      guildId,
      next.prefix,
      JSON.stringify(next.modules),
      JSON.stringify(next.community),
      JSON.stringify(next.logging),
      JSON.stringify(next.automod),
      JSON.stringify(next.ai_chat),
    ],
  );
}

export interface HeartbeatRow {
  cluster_id: string;
  shard_id: number;
  guild_count: number;
  ping_ms: number;
  updated_at: string;
}

/** Shard/cluster heartbeats for /status and the admin panel. The
 *  table is created by bot migration 0005; tolerate its absence so
 *  the public site works before the bot has ever run. */
export async function getHeartbeats(): Promise<HeartbeatRow[] | null> {
  try {
    const res = await db().query<HeartbeatRow>(
      `SELECT cluster_id, shard_id, guild_count, ping_ms, updated_at
       FROM shard_heartbeats ORDER BY cluster_id, shard_id`,
    );
    return res.rows;
  } catch {
    return null;
  }
}

export async function listConfiguredGuildIds(): Promise<string[]> {
  try {
    const res = await db().query<{ guild_id: string }>(`SELECT guild_id FROM guild_settings ORDER BY guild_id`);
    return res.rows.map((r) => r.guild_id);
  } catch {
    return [];
  }
}

/** Site-wide settings (migration 0008), edited from the Admin panel and
 *  read by the public layout — e.g. the Support link in the menu.
 *  Tolerates a missing table so the site works before migration 0008. */
export async function getSiteSetting(key: string): Promise<string | null> {
  try {
    const res = await db().query<{ value: string }>(
      `SELECT value FROM site_settings WHERE key = $1`,
      [key],
    );
    return res.rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setSiteSetting(key: string, value: string): Promise<void> {
  await db().query(
    `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, value],
  );
}

/** Owner-edited global bot config (migration 0009, bot_config table).
 *  The bot reads the same table with a short cache. */
export async function getBotConfig<T>(key: string): Promise<T | null> {
  try {
    const res = await db().query<{ value: T }>(`SELECT value FROM bot_config WHERE key = $1`, [
      key,
    ]);
    return res.rows[0]?.value ?? null;
  } catch {
    return null;
  }
}

export async function setBotConfig(key: string, value: unknown): Promise<void> {
  await db().query(
    `INSERT INTO bot_config (key, value, updated_at) VALUES ($1, $2::jsonb, now())
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [key, JSON.stringify(value)],
  );
}

export interface GuildAdminRow {
  guild_id: string;
  prefix: string;
  modules: Record<string, boolean>;
  ai_chat: { enabled?: boolean };
  updated_at: string;
}

export async function listGuildAdminRows(): Promise<GuildAdminRow[]> {
  try {
    const res = await db().query<GuildAdminRow>(
      `SELECT guild_id, prefix, modules, ai_chat, updated_at FROM guild_settings ORDER BY updated_at DESC`,
    );
    return res.rows;
  } catch {
    return [];
  }
}

export interface EconomyStats {
  accounts: number;
  circulating: number;
  ledger24h: number;
  mintedToday: number;
  burnedToday: number;
  top: { user_id: string; balance: string }[];
}

/** System-wide economy numbers for the admin overview/economy pages.
 *  Ledger deltas: positive = minted into circulation, negative = burned
 *  (transfers write a -/+ pair and cancel out). */
export async function getEconomyStats(): Promise<EconomyStats | null> {
  try {
    const acc = await db().query<{ n: string; total: string }>(
      `SELECT COUNT(*)::text AS n, COALESCE(SUM(balance),0)::text AS total FROM economy_accounts`,
    );
    const led = await db().query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM economy_ledger WHERE created_at > now() - interval '24 hours'`,
    );
    const flow = await db().query<{ minted: string; burned: string }>(
      `SELECT COALESCE(SUM(delta) FILTER (WHERE delta > 0),0)::text AS minted,
              COALESCE(-SUM(delta) FILTER (WHERE delta < 0),0)::text AS burned
       FROM economy_ledger WHERE created_at >= date_trunc('day', now())`,
    );
    const top = await db().query<{ user_id: string; balance: string }>(
      `SELECT user_id, balance::text AS balance FROM economy_accounts ORDER BY balance DESC LIMIT 5`,
    );
    return {
      accounts: Number.parseInt(acc.rows[0]?.n || "0", 10),
      circulating: Number.parseInt(acc.rows[0]?.total || "0", 10),
      ledger24h: Number.parseInt(led.rows[0]?.n || "0", 10),
      mintedToday: Number.parseInt(flow.rows[0]?.minted || "0", 10),
      burnedToday: Number.parseInt(flow.rows[0]?.burned || "0", 10),
      top: top.rows,
    };
  } catch {
    return null;
  }
}

export interface EconomyChart {
  days: { day: string; tx: number; minted: number; burned: number }[];
  sources: { source: string; tx: number; volume: number }[];
}

/** Chart data for the admin overview: per-day economy activity for the
 *  last 14 days (zero-filled) and the all-time breakdown by ledger
 *  source. */
export async function getEconomyChart(): Promise<EconomyChart | null> {
  try {
    const dayRes = await db().query<{ day: string; tx: string; minted: string; burned: string }>(
      `SELECT to_char(d::date, 'YYYY-MM-DD') AS day,
              COUNT(l.id)::text AS tx,
              COALESCE(SUM(l.delta) FILTER (WHERE l.delta > 0), 0)::text AS minted,
              COALESCE(-SUM(l.delta) FILTER (WHERE l.delta < 0), 0)::text AS burned
       FROM generate_series(current_date - interval '13 days', current_date, interval '1 day') AS d
       LEFT JOIN economy_ledger l ON l.created_at::date = d::date
       GROUP BY d ORDER BY d`,
    );
    const srcRes = await db().query<{ source: string; tx: string; volume: string }>(
      `SELECT source, COUNT(*)::text AS tx, COALESCE(SUM(ABS(delta)), 0)::text AS volume
       FROM economy_ledger GROUP BY source ORDER BY COUNT(*) DESC LIMIT 8`,
    );
    return {
      days: dayRes.rows.map((r) => ({
        day: r.day,
        tx: Number.parseInt(r.tx, 10),
        minted: Number.parseInt(r.minted, 10),
        burned: Number.parseInt(r.burned, 10),
      })),
      sources: srcRes.rows.map((r) => ({
        source: r.source,
        tx: Number.parseInt(r.tx, 10),
        volume: Number.parseInt(r.volume, 10),
      })),
    };
  } catch {
    return null;
  }
}
