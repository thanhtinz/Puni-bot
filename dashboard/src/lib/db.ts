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
