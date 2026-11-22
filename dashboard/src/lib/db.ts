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

export interface LedgerRow {
  id: number;
  user_id: string;
  delta: number;
  balance_after: number;
  source: string;
  note: string | null;
  created_at: string;
}

/** Owner manual balance adjustment (Admin panel → Người dùng). Mirrors
 *  the bot's PgEconomyStore transaction exactly: lock the account row,
 *  update the balance, append the ledger entry — all-or-nothing.
 *  Negative results are refused so an account can never go below 0. */
export async function adminAdjustBalance(
  userId: string,
  delta: number,
  note: string,
): Promise<{ balance: number } | { error: string }> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO economy_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
      [userId],
    );
    const res = await client.query<{ balance: string }>(
      "SELECT balance FROM economy_accounts WHERE user_id = $1 FOR UPDATE",
      [userId],
    );
    const current = Number.parseInt(res.rows[0]?.balance ?? "0", 10);
    const next = current + delta;
    if (next < 0) {
      await client.query("ROLLBACK");
      return { error: `Số dư hiện tại chỉ có ${current.toLocaleString("vi-VN")}, không trừ thêm được.` };
    }
    await client.query("UPDATE economy_accounts SET balance = $2, updated_at = now() WHERE user_id = $1", [
      userId,
      next,
    ]);
    await client.query(
      `INSERT INTO economy_ledger (user_id, delta, balance_after, source, note) VALUES ($1, $2, $3, 'admin', $4)`,
      [userId, delta, next, note.slice(0, 200)],
    );
    await client.query("COMMIT");
    return { balance: next };
  } catch (err) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw err;
  } finally {
    client.release();
  }
}

export async function getUserEconomy(
  userId: string,
): Promise<{ balance: number; ledger: LedgerRow[] } | null> {
  try {
    const acc = await db().query<{ balance: string }>(
      "SELECT balance FROM economy_accounts WHERE user_id = $1",
      [userId],
    );
    const led = await db().query<LedgerRow>(
      `SELECT id, user_id, delta::int AS delta, balance_after::int AS balance_after, source, note,
              created_at::text AS created_at
       FROM economy_ledger WHERE user_id = $1 ORDER BY id DESC LIMIT 20`,
      [userId],
    );
    return {
      balance: Number.parseInt(acc.rows[0]?.balance ?? "0", 10),
      ledger: led.rows,
    };
  } catch {
    return null;
  }
}

export async function listRecentLedger(limit = 50): Promise<LedgerRow[] | null> {
  try {
    const res = await db().query<LedgerRow>(
      `SELECT id, user_id, delta::int AS delta, balance_after::int AS balance_after, source, note,
              created_at::text AS created_at
       FROM economy_ledger ORDER BY id DESC LIMIT $1`,
      [limit],
    );
    return res.rows;
  } catch {
    return null;
  }
}

export interface MembershipRow {
  user_id: string;
  tier_id: string;
  started_at: string;
  expires_at: string;
  source: string;
  note: string;
  active: boolean;
}

/** All membership records, active first then by expiry (Admin panel). */
export async function listMemberships(): Promise<MembershipRow[] | null> {
  try {
    const res = await db().query<MembershipRow>(
      `SELECT user_id, tier_id, started_at::text AS started_at, expires_at::text AS expires_at,
              source, note, (expires_at > now()) AS active
       FROM memberships ORDER BY (expires_at > now()) DESC, expires_at DESC LIMIT 200`,
    );
    return res.rows;
  } catch {
    return null;
  }
}

/** Grant/extend — same stacking rule as the bot's PgMembershipStore:
 *  expiry grows from the later of now / current expiry. */
export async function grantMembership(input: {
  userId: string;
  tierId: string;
  days: number;
  source: string;
  note: string;
}): Promise<void> {
  await db().query(
    `INSERT INTO memberships (user_id, tier_id, started_at, expires_at, source, note, updated_at)
     VALUES ($1, $2, now(), now() + ($3 || ' days')::interval, $4, $5, now())
     ON CONFLICT (user_id) DO UPDATE SET
       tier_id = EXCLUDED.tier_id,
       started_at = CASE WHEN memberships.tier_id = EXCLUDED.tier_id THEN memberships.started_at ELSE EXCLUDED.started_at END,
       expires_at = GREATEST(memberships.expires_at, EXCLUDED.started_at) + ($3 || ' days')::interval,
       source = EXCLUDED.source,
       note = EXCLUDED.note,
       updated_at = now()`,
    [input.userId, input.tierId, String(input.days), input.source.slice(0, 40), input.note.slice(0, 200)],
  );
}

export async function revokeMembership(userId: string): Promise<void> {
  await db().query(`DELETE FROM memberships WHERE user_id = $1`, [userId]);
}

/** Lifetime totals for one user from the ledger (Admin → Người dùng). */
export async function getUserEconomyTotals(
  userId: string,
): Promise<{ earned: number; spent: number; tx: number } | null> {
  try {
    const res = await db().query<{ earned: string; spent: string; tx: string }>(
      `SELECT COALESCE(SUM(delta) FILTER (WHERE delta > 0), 0)::text AS earned,
              COALESCE(-SUM(delta) FILTER (WHERE delta < 0), 0)::text AS spent,
              COUNT(*)::text AS tx
       FROM economy_ledger WHERE user_id = $1`,
      [userId],
    );
    const r = res.rows[0];
    return {
      earned: Number.parseInt(r?.earned ?? "0", 10),
      spent: Number.parseInt(r?.spent ?? "0", 10),
      tx: Number.parseInt(r?.tx ?? "0", 10),
    };
  } catch {
    return null;
  }
}

export async function getUserMembership(userId: string): Promise<MembershipRow | null> {
  try {
    const res = await db().query<MembershipRow>(
      `SELECT user_id, tier_id, started_at::text AS started_at, expires_at::text AS expires_at,
              source, note, (expires_at > now()) AS active
       FROM memberships WHERE user_id = $1`,
      [userId],
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

/** bot_config keys + last-updated times (metadata only, never values). */
export async function listBotConfigMeta(): Promise<{ key: string; updated_at: string }[] | null> {
  try {
    const res = await db().query<{ key: string; updated_at: string }>(
      `SELECT key, updated_at::text AS updated_at FROM bot_config ORDER BY key`,
    );
    return res.rows;
  } catch {
    return null;
  }
}

/* ---------------- Cozy World content (Admin-managed, spec 6.17) ---- */

export interface SpeciesRow {
  id: string;
  name: string;
  types: string;
  rarity: string;
  base_hp: number;
  base_atk: number;
  base_def: number;
  base_spd: number;
  description: string;
  sprite_url: string;
  member_exclusive: boolean;
  enabled: boolean;
}

export async function listSpecies(): Promise<SpeciesRow[] | null> {
  try {
    const res = await db().query<SpeciesRow>(
      `SELECT * FROM game_species ORDER BY name LIMIT 500`,
    );
    return res.rows;
  } catch {
    return null;
  }
}

export async function upsertSpecies(s: SpeciesRow): Promise<void> {
  await db().query(
    `INSERT INTO game_species (id, name, types, rarity, base_hp, base_atk, base_def, base_spd, description, sprite_url, member_exclusive, enabled, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12, now())
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, types=EXCLUDED.types, rarity=EXCLUDED.rarity,
       base_hp=EXCLUDED.base_hp, base_atk=EXCLUDED.base_atk, base_def=EXCLUDED.base_def, base_spd=EXCLUDED.base_spd,
       description=EXCLUDED.description, sprite_url=EXCLUDED.sprite_url,
       member_exclusive=EXCLUDED.member_exclusive, enabled=EXCLUDED.enabled, updated_at=now()`,
    [s.id, s.name, s.types, s.rarity, s.base_hp, s.base_atk, s.base_def, s.base_spd, s.description, s.sprite_url, s.member_exclusive, s.enabled],
  );
}

export async function deleteSpecies(id: string): Promise<void> {
  await db().query(`DELETE FROM game_species WHERE id = $1`, [id]);
}

export async function setSpeciesEnabled(id: string, enabled: boolean): Promise<void> {
  await db().query(`UPDATE game_species SET enabled = $2, updated_at = now() WHERE id = $1`, [id, enabled]);
}

export interface ItemRow {
  id: string;
  name: string;
  category: string;
  price_coins: string;
  price_gems: string;
  sell_price: string;
  description: string;
  icon_url: string;
  enabled: boolean;
}

export const ITEM_CATEGORIES: { id: string; label: string }[] = [
  { id: "seed", label: "Hạt giống" },
  { id: "crop", label: "Nông sản" },
  { id: "farm_tool", label: "Dụng cụ nông trại" },
  { id: "fish", label: "Cá (câu cá)" },
  { id: "consumable", label: "Tiêu hao" },
  { id: "material", label: "Nguyên liệu" },
  { id: "other", label: "Khác" },
];

export async function listItems(category?: string): Promise<ItemRow[] | null> {
  try {
    const res = category
      ? await db().query<ItemRow>(
          `SELECT id, name, category, price_coins::text AS price_coins, price_gems::text AS price_gems,
                  sell_price::text AS sell_price, description, icon_url, enabled
           FROM game_items WHERE category = $1 ORDER BY name LIMIT 500`,
          [category],
        )
      : await db().query<ItemRow>(
          `SELECT id, name, category, price_coins::text AS price_coins, price_gems::text AS price_gems,
                  sell_price::text AS sell_price, description, icon_url, enabled
           FROM game_items ORDER BY category, name LIMIT 500`,
        );
    return res.rows;
  } catch {
    return null;
  }
}

export async function upsertItem(i: {
  id: string; name: string; category: string;
  priceCoins: number; priceGems: number; sellPrice: number;
  description: string; iconUrl: string; enabled: boolean;
}): Promise<void> {
  await db().query(
    `INSERT INTO game_items (id, name, category, price_coins, price_gems, sell_price, description, icon_url, enabled, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9, now())
     ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name, category=EXCLUDED.category,
       price_coins=EXCLUDED.price_coins, price_gems=EXCLUDED.price_gems, sell_price=EXCLUDED.sell_price,
       description=EXCLUDED.description, icon_url=EXCLUDED.icon_url, enabled=EXCLUDED.enabled, updated_at=now()`,
    [i.id, i.name, i.category, i.priceCoins, i.priceGems, i.sellPrice, i.description, i.iconUrl, i.enabled],
  );
}

export async function deleteItem(id: string): Promise<void> {
  await db().query(`DELETE FROM game_items WHERE id = $1`, [id]);
}

export async function setItemEnabled(id: string, enabled: boolean): Promise<void> {
  await db().query(`UPDATE game_items SET enabled = $2, updated_at = now() WHERE id = $1`, [id, enabled]);
}

export interface ShopListingRow {
  id: string;
  item_id: string;
  item_name: string;
  item_price_coins: string;
  item_price_gems: string;
  price_coins: string | null;
  price_gems: string | null;
  stock: number | null;
  sort: number;
  enabled: boolean;
}

export async function listShopListings(): Promise<ShopListingRow[] | null> {
  try {
    const res = await db().query<ShopListingRow>(
      `SELECT l.id::text AS id, l.item_id, i.name AS item_name,
              i.price_coins::text AS item_price_coins, i.price_gems::text AS item_price_gems,
              l.price_coins::text AS price_coins, l.price_gems::text AS price_gems,
              l.stock, l.sort, l.enabled
       FROM game_shop_listings l JOIN game_items i ON i.id = l.item_id
       ORDER BY l.sort, i.name LIMIT 500`,
    );
    return res.rows;
  } catch {
    return null;
  }
}

export async function upsertShopListing(input: {
  itemId: string;
  priceCoins: number | null;
  priceGems: number | null;
  stock: number | null;
  sort: number;
  enabled: boolean;
}): Promise<void> {
  await db().query(
    `INSERT INTO game_shop_listings (item_id, price_coins, price_gems, stock, sort, enabled, updated_at)
     VALUES ($1,$2,$3,$4,$5,$6, now())
     ON CONFLICT (item_id) DO UPDATE SET price_coins=EXCLUDED.price_coins, price_gems=EXCLUDED.price_gems,
       stock=EXCLUDED.stock, sort=EXCLUDED.sort, enabled=EXCLUDED.enabled, updated_at=now()`,
    [input.itemId, input.priceCoins, input.priceGems, input.stock, input.sort, input.enabled],
  );
}

export async function deleteShopListing(id: string): Promise<void> {
  await db().query(`DELETE FROM game_shop_listings WHERE id = $1`, [id]);
}

export async function setShopListingEnabled(id: string, enabled: boolean): Promise<void> {
  await db().query(`UPDATE game_shop_listings SET enabled = $2, updated_at = now() WHERE id = $1`, [id, enabled]);
}

/* ---------------- Membership orders (spec 6.19 purchase flow) ------ */

export interface MembershipOrderRow {
  code: string;
  user_id: string;
  tier_id: string;
  tier_name: string;
  amount: string;
  days: number;
  status: string;
  created_at: string;
  paid_at: string | null;
  expired: boolean;
}

const ORDER_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newOrderCode(): string {
  let suffix = "";
  for (let i = 0; i < 6; i++) {
    suffix += ORDER_CODE_ALPHABET[Math.floor(Math.random() * ORDER_CODE_ALPHABET.length)];
  }
  return `PUNI-${suffix}`;
}

/** Create a pending order. Refuses when the buyer already has 3+
 *  pending orders (spam brake) — returns null in that case. */
export async function createMembershipOrder(input: {
  userId: string;
  tierId: string;
  tierName: string;
  amount: number;
  days: number;
}): Promise<MembershipOrderRow | null> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const pending = await client.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM membership_orders WHERE user_id = $1 AND status = 'pending'`,
      [input.userId],
    );
    if (Number.parseInt(pending.rows[0]?.n ?? "0", 10) >= 3) {
      await client.query("ROLLBACK");
      return null;
    }
    for (let attempt = 0; attempt < 5; attempt++) {
      const code = newOrderCode();
      try {
        const res = await client.query<MembershipOrderRow>(
          `INSERT INTO membership_orders (code, user_id, tier_id, tier_name, amount, days, status)
           VALUES ($1, $2, $3, $4, $5, $6, 'pending')
           RETURNING code, user_id, tier_id, tier_name, amount::text AS amount, days, status,
                     created_at::text AS created_at, paid_at::text AS paid_at,
                     false AS expired`,
          [code, input.userId, input.tierId, input.tierName, input.amount, input.days],
        );
        await client.query("COMMIT");
        return res.rows[0];
      } catch (e) {
        // Unique-code collision: retry with a fresh code.
        if ((e as { code?: string }).code !== "23505") throw e;
      }
    }
    await client.query("ROLLBACK");
    return null;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function getMembershipOrder(code: string): Promise<MembershipOrderRow | null> {
  try {
    const res = await db().query<MembershipOrderRow>(
      `SELECT code, user_id, tier_id, tier_name, amount::text AS amount, days, status,
              created_at::text AS created_at, paid_at::text AS paid_at,
              (status = 'pending' AND created_at < now() - interval '24 hours') AS expired
       FROM membership_orders WHERE code = $1`,
      [code],
    );
    return res.rows[0] ?? null;
  } catch {
    return null;
  }
}

export async function listMembershipOrders(limit = 50): Promise<MembershipOrderRow[] | null> {
  try {
    const res = await db().query<MembershipOrderRow>(
      `SELECT code, user_id, tier_id, tier_name, amount::text AS amount, days, status,
              created_at::text AS created_at, paid_at::text AS paid_at,
              (status = 'pending' AND created_at < now() - interval '24 hours') AS expired
       FROM membership_orders ORDER BY created_at DESC LIMIT $1`,
      [limit],
    );
    return res.rows;
  } catch {
    return null;
  }
}

/**
 * Confirm payment for an order and grant the membership in ONE
 * transaction. Idempotent: an already-paid order returns 'already'
 * without granting twice. The grant mirrors the stacking rule of the
 * bot's PgMembershipStore.
 */
export async function confirmMembershipOrder(
  code: string,
): Promise<{ result: "confirmed" | "already" | "not_found" | "cancelled" | "amount_guard"; userId?: string }> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query<{
      user_id: string; tier_id: string; days: number; status: string;
    }>(`SELECT user_id, tier_id, days, status FROM membership_orders WHERE code = $1 FOR UPDATE`, [code]);
    const order = res.rows[0];
    if (!order) {
      await client.query("ROLLBACK");
      return { result: "not_found" };
    }
    if (order.status === "paid") {
      await client.query("COMMIT");
      return { result: "already", userId: order.user_id };
    }
    if (order.status === "cancelled") {
      await client.query("ROLLBACK");
      return { result: "cancelled" };
    }
    await client.query(
      `UPDATE membership_orders SET status = 'paid', paid_at = now() WHERE code = $1`,
      [code],
    );
    await client.query(
      `INSERT INTO memberships (user_id, tier_id, started_at, expires_at, source, note, updated_at)
       VALUES ($1, $2, now(), now() + ($3 || ' days')::interval, 'order', $4, now())
       ON CONFLICT (user_id) DO UPDATE SET
         tier_id = EXCLUDED.tier_id,
         started_at = CASE WHEN memberships.tier_id = EXCLUDED.tier_id THEN memberships.started_at ELSE EXCLUDED.started_at END,
         expires_at = GREATEST(memberships.expires_at, EXCLUDED.started_at) + ($3 || ' days')::interval,
         source = EXCLUDED.source,
         note = EXCLUDED.note,
         updated_at = now()`,
      [order.user_id, order.tier_id, String(order.days), `Đơn ${code}`],
    );
    await client.query("COMMIT");
    return { result: "confirmed", userId: order.user_id };
  } catch (e) {
    await client.query("ROLLBACK").catch(() => undefined);
    throw e;
  } finally {
    client.release();
  }
}

export async function cancelMembershipOrder(code: string): Promise<boolean> {
  const res = await db().query(
    `UPDATE membership_orders SET status = 'cancelled' WHERE code = $1 AND status = 'pending'`,
    [code],
  );
  return (res.rowCount ?? 0) > 0;
}
