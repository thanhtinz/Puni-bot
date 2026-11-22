/**
 * Web card shop (spec 6.24): the system shop inside the player area.
 * Sells (a) card packs for Coins — credited to the same tcg_wallets
 * the bot and the gacha page use — and (b) a daily rotating set of
 * featured single cards at their full system value (BASE_VALUE at
 * level 1; the system buys back at the sell rate, so this spread is
 * the shop's margin, same as the bot economy design).
 *
 * Featured rotation is deterministic per UTC day: a seeded RNG picks
 * from rarity buckets, so every visitor sees the same shelf and the
 * server can recompute it at purchase time — the client never names
 * a price, and a card that is not on today's shelf cannot be bought.
 * Every purchase is ONE transaction (debit + grant together).
 */
import { db } from "./db";
import { adjustBalanceTx, cardValue, getPriceCoinsPerUsd } from "./player";
import { userPerksWeb } from "./gacha";

export const SHOP_PACK_PRICES = { standard: 2000, premium: 5000 } as const;

type TxResult = { ok: true } | { ok: false; error: string };

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function newInstanceCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

/** mulberry32 — tiny deterministic RNG for the daily shelf. */
function seededRng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dateSeed(dateStr: string): number {
  let h = 2166136261;
  for (let i = 0; i < dateStr.length; i++) {
    h ^= dateStr.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export interface FeaturedCard {
  speciesId: string;
  rarity: string;
  memberExclusive: boolean;
  price: number;
  name: string;
  spriteUrl: string;
}

const FEATURED_SLOTS = ["Common", "Uncommon", "Rare", "Rare", "Epic", "Legendary"] as const;

/** Today's featured shelf (UTC day). Same result for every caller. */
export async function featuredCards(dateStr?: string): Promise<FeaturedCard[]> {
  const day = dateStr ?? new Date().toISOString().slice(0, 10);
  const res = await db().query(
    `SELECT id, name, sprite_url, rarity, member_exclusive, price_usd, market_price_coins FROM game_species WHERE enabled ORDER BY id`,
  );
  const rows = res.rows as unknown as Array<{ id: string; name: string; sprite_url: string | null; rarity: string; member_exclusive: boolean; price_usd: string | number | null; market_price_coins: string | number | null }>;
  const byRarity = new Map<string, Array<{ id: string; name: string; sprite_url: string | null; member_exclusive: boolean; price_usd: string | number | null; market_price_coins: string | number | null }>>();
  for (const r of rows) {
    const list = byRarity.get(r.rarity) ?? [];
    list.push({ id: r.id, name: r.name, sprite_url: r.sprite_url, member_exclusive: r.member_exclusive, price_usd: r.price_usd, market_price_coins: r.market_price_coins });
    byRarity.set(r.rarity, list);
  }
  const priceRate = await getPriceCoinsPerUsd();
  const rng = seededRng(dateSeed(day));
  const picked: FeaturedCard[] = [];
  const used = new Set<string>();
  for (const slot of FEATURED_SLOTS) {
    const pool = (byRarity.get(slot) ?? []).filter((s) => !used.has(s.id));
    if (!pool.length) continue;
    const choice = pool[Math.floor(rng() * pool.length)];
    used.add(choice.id);
    picked.push({
      speciesId: choice.id,
      rarity: slot,
      memberExclusive: choice.member_exclusive,
      name: choice.name,
      spriteUrl: choice.sprite_url ?? "",
      price: cardValue(slot, 1, 0, choice.price_usd != null ? Number(choice.price_usd) : undefined, priceRate, choice.market_price_coins != null ? Number(choice.market_price_coins) : undefined),
    });
  }
  return picked;
}

type TxClient = { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, string>[] }> };

async function withTx<T>(fn: (client: TxClient) => Promise<T>): Promise<T> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const out = await fn(client as unknown as TxClient);
    await client.query("COMMIT");
    return out;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

/** Buy one pack with Coins; the pack lands in tcg_wallets. */
export async function buyPackWeb(userId: string, premium: boolean): Promise<TxResult> {
  const price = premium ? SHOP_PACK_PRICES.premium : SHOP_PACK_PRICES.standard;
  return withTx(async (client) => {
    const paid = await adjustBalanceTx(
      client, userId, -price, "tcg-shop",
      `Mua ${premium ? "Gói Cao Cấp" : "Gói Thường"} ở Shop (web)`,
    );
    if (!paid) return { ok: false as const, error: "Không đủ Coins." };
    await client.query(
      `INSERT INTO tcg_wallets (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
      [userId],
    );
    await client.query(
      premium
        ? `UPDATE tcg_wallets SET packs_premium = packs_premium + 1 WHERE user_id = $1`
        : `UPDATE tcg_wallets SET packs_standard = packs_standard + 1 WHERE user_id = $1`,
      [userId],
    );
    return { ok: true as const };
  });
}

/** Shared purchase core: debit + grant one fresh instance, atomically. */
async function buySpeciesTx(
  userId: string, speciesId: string, price: number,
): Promise<{ ok: true; code: string; price: number } | { ok: false; error: string }> {
  return withTx(async (client) => {
    const paid = await adjustBalanceTx(
      client, userId, -price, "tcg-shop", `Mua thẻ ${speciesId} ở Shop (web)`,
    );
    if (!paid) return { ok: false as const, error: "Không đủ Coins." };
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = newInstanceCode();
      const res = await client.query(
        `INSERT INTO tcg_instances (code, user_id, species_id, obtained) VALUES ($1, $2, $3, 'shop')
         ON CONFLICT (code) DO NOTHING RETURNING code`,
        [code, userId, speciesId],
      );
      if (res.rows.length) return { ok: true as const, code, price };
    }
    throw new Error("could not allocate instance code");
  });
}

/** Buy one of today's featured cards. Price is recomputed server-side. */
export async function buyFeaturedCardWeb(
  userId: string, speciesId: string,
): Promise<{ ok: true; code: string; price: number } | { ok: false; error: string }> {
  const shelf = await featuredCards();
  const item = shelf.find((f) => f.speciesId === speciesId);
  if (!item) return { ok: false, error: "Thẻ này không có trong Shop hôm nay." };
  if (item.memberExclusive) {
    const perks = await userPerksWeb(userId);
    if (!perks?.exclusivePets) {
      return { ok: false, error: "Thẻ độc quyền chỉ dành cho hội viên." };
    }
  }
  return buySpeciesTx(userId, speciesId, item.price);
}

/* ---------- TCGplayer-style singles catalog (spec 6.36) ---------- */

export interface ShopGame {
  prefix: string;
  like: string;
  name: string;
}

/** The 19 card families, keyed by their species-id prefix. */
export const SHOP_GAMES: ShopGame[] = [
  { prefix: "opjp", like: "opjp-%", name: "One Piece JP" },
  { prefix: "pkmjp", like: "pkmjp-%", name: "Pokémon JP" },
  { prefix: "gunjp", like: "gunjp-%", name: "Gundam JP" },
  { prefix: "op", like: "op%", name: "One Piece" },
  { prefix: "pkm", like: "pkm-%", name: "Pokémon" },
  { prefix: "mtg", like: "mtg-%", name: "Magic: The Gathering" },
  { prefix: "ygo", like: "ygo-%", name: "Yu-Gi-Oh!" },
  { prefix: "dig", like: "dig-%", name: "Digimon" },
  { prefix: "lor", like: "lor-%", name: "Disney Lorcana" },
  { prefix: "dbf", like: "dbf-%", name: "Dragon Ball Fusion World" },
  { prefix: "dbm", like: "dbm-%", name: "Dragon Ball Super Masters" },
  { prefix: "ff", like: "ff-%", name: "Final Fantasy TCG" },
  { prefix: "fab", like: "fab-%", name: "Flesh and Blood" },
  { prefix: "gun", like: "gun-%", name: "Gundam Card Game" },
  { prefix: "swu", like: "swu-%", name: "Star Wars: Unlimited" },
  { prefix: "una", like: "una-%", name: "Union Arena" },
  { prefix: "cfv", like: "cfv-%", name: "Cardfight!! Vanguard" },
  { prefix: "myl", like: "myl-%", name: "Mitos y Leyendas" },
  { prefix: "rift", like: "rift-%", name: "Riftbound" },
  { prefix: "pal", like: "pal-%", name: "Palworld" },
  { prefix: "cyb", like: "cyb-%", name: "Cyberpunk TCG" },
  { prefix: "holo", like: "holo-%", name: "hololive OCG" },
];

export function shopGameOf(speciesId: string): ShopGame | null {
  return (
    SHOP_GAMES.find((g) =>
      g.prefix === "op" ? speciesId.startsWith("op") : speciesId.startsWith(`${g.prefix}-`),
    ) ?? null
  );
}

/** Level-1 system value in SQL — mirrors cardValue() in player.ts.
 *  __RATE__ is replaced with the Coins-per-USD parameter placeholder. */
const VALUE_SQL = `CASE
  WHEN s.market_price_coins > 0 THEN s.market_price_coins::float8
  WHEN s.price_usd > 0 THEN s.price_usd::float8 * __RATE__::float8
  ELSE CASE s.rarity
    WHEN 'Common' THEN 50 WHEN 'Uncommon' THEN 150 WHEN 'Rare' THEN 500
    WHEN 'Epic' THEN 2000 WHEN 'Legendary' THEN 9000 WHEN 'Mythical' THEN 20000
    WHEN 'Fabled' THEN 50000 ELSE 0 END
END`;

const RARITY_RANK_SQL = `CASE s.rarity
  WHEN 'Fabled' THEN 7 WHEN 'Mythical' THEN 6 WHEN 'Legendary' THEN 5
  WHEN 'Epic' THEN 4 WHEN 'Rare' THEN 3 WHEN 'Uncommon' THEN 2 ELSE 1 END`;

export interface CatalogCard {
  speciesId: string;
  name: string;
  spriteUrl: string;
  rarity: string;
  setId: string;
  setName: string;
  memberExclusive: boolean;
  price: number;
}

export interface CatalogQuery {
  q?: string;
  game?: string;
  set?: string;
  rarity?: string;
  sort?: string;
  page?: number;
}

export const CATALOG_PAGE_SIZE = 48;
export const CATALOG_RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Fabled"] as const;

export async function shopCatalog(
  query: CatalogQuery,
): Promise<{ rows: CatalogCard[]; total: number }> {
  const rate = await getPriceCoinsPerUsd();
  // Filter params come first ($1..$n) so the COUNT query — which does
  // not need the rate — never carries an unreferenced parameter
  // (PostgreSQL rejects those with 42P18).
  const params: unknown[] = [];
  const where: string[] = ["s.enabled"];
  const game = SHOP_GAMES.find((g) => g.prefix === query.game);
  if (game) {
    params.push(game.like);
    where.push(`s.id LIKE $${params.length}`);
  }
  if (query.set) {
    params.push(query.set.slice(0, 80));
    where.push(`s.set_id = $${params.length}`);
  }
  if (query.rarity && (CATALOG_RARITIES as readonly string[]).includes(query.rarity)) {
    params.push(query.rarity);
    where.push(`s.rarity = $${params.length}`);
  }
  if (query.q) {
    params.push(`%${query.q.slice(0, 60)}%`);
    where.push(`s.name ILIKE $${params.length}`);
  }
  const valueSql = VALUE_SQL.replaceAll("__RATE__", `$${params.length + 1}`);
  const order =
    query.sort === "price-asc"
      ? `${valueSql} ASC, s.id`
      : query.sort === "name"
        ? `s.name ASC, s.id`
        : query.sort === "rarity"
          ? `${RARITY_RANK_SQL} DESC, ${valueSql} DESC, s.id`
          : `${valueSql} DESC, s.id`;
  const page = Math.max(1, Math.floor(query.page ?? 1));
  const whereSql = where.join(" AND ");
  try {
    const countRes = await db().query(
      `SELECT COUNT(*)::int AS n FROM game_species s WHERE ${whereSql}`,
      params,
    );
    const total = (countRes.rows[0] as unknown as { n: number }).n;
    params.push(rate, CATALOG_PAGE_SIZE, (page - 1) * CATALOG_PAGE_SIZE);
    const res = await db().query(
      `SELECT s.id, s.name, s.sprite_url, s.rarity, s.set_id,
              COALESCE(g.name, s.set_id) AS set_name, s.member_exclusive,
              ${valueSql} AS value_coins
       FROM game_species s LEFT JOIN game_sets g ON g.id = s.set_id
       WHERE ${whereSql}
       ORDER BY ${order}
       LIMIT $${params.length - 1} OFFSET $${params.length}`,
      params,
    );
    const rows = (res.rows as unknown as Array<{
      id: string; name: string; sprite_url: string | null; rarity: string; set_id: string;
      set_name: string; member_exclusive: boolean; value_coins: number;
    }>).map((r) => ({
      speciesId: r.id,
      name: r.name,
      spriteUrl: r.sprite_url ?? "",
      rarity: r.rarity,
      setId: r.set_id,
      setName: r.set_name,
      memberExclusive: r.member_exclusive,
      price: Math.round(Number(r.value_coins) * 10000) / 10000,
    }));
    return { rows, total };
  } catch (e) {
    console.error("shopCatalog failed:", e);
    return { rows: [], total: 0 };
  }
}

/** Sets that actually occur inside one game family (for the filter select). */
export async function shopSets(gamePrefix: string): Promise<{ id: string; name: string; count: number }[]> {
  const game = SHOP_GAMES.find((g) => g.prefix === gamePrefix);
  if (!game) return [];
  try {
    const res = await db().query(
      `SELECT s.set_id AS id, COALESCE(g.name, s.set_id) AS name, COUNT(*)::int AS count
       FROM game_species s LEFT JOIN game_sets g ON g.id = s.set_id
       WHERE s.enabled AND s.id LIKE $1
       GROUP BY s.set_id, g.name ORDER BY count DESC, s.set_id`,
      [game.like],
    );
    return res.rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) }));
  } catch {
    return [];
  }
}

export interface SpeciesDetail {
  speciesId: string;
  name: string;
  spriteUrl: string;
  rarity: string;
  setId: string;
  setName: string;
  gameName: string;
  memberExclusive: boolean;
  baseHp: number | null;
  baseAtk: number | null;
  price: number;
  priceUsd: number | null;
  owned: number;
  listings: { id: number; price: number; sellerId: string }[];
  sales: { price: number; soldAt: Date }[];
}

export async function shopSpeciesDetail(
  speciesId: string, userId: string,
): Promise<SpeciesDetail | null> {
  try {
    const res = await db().query(
      `SELECT s.id, s.name, s.sprite_url, s.rarity, s.set_id, COALESCE(g.name, s.set_id) AS set_name,
              s.member_exclusive, s.base_hp, s.base_atk, s.price_usd, s.market_price_coins
       FROM game_species s LEFT JOIN game_sets g ON g.id = s.set_id
       WHERE s.id = $1 AND s.enabled`,
      [speciesId],
    );
    const r = res.rows[0] as unknown as {
      id: string; name: string; sprite_url: string | null; rarity: string; set_id: string;
      set_name: string; member_exclusive: boolean; base_hp: number | null; base_atk: number | null;
      price_usd: string | number | null; market_price_coins: string | number | null;
    } | undefined;
    if (!r) return null;
    const rate = await getPriceCoinsPerUsd();
    const ownedRes = await db().query(
      `SELECT COUNT(*)::int AS n FROM tcg_instances WHERE user_id = $1 AND species_id = $2`,
      [userId, speciesId],
    );
    const listRes = await db().query(
      `SELECT l.id, l.price::text AS price, l.seller_id
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       WHERE i.species_id = $1 AND l.status = 'open'
       ORDER BY l.price ASC LIMIT 6`,
      [speciesId],
    );
    const salesRes = await db().query(
      `SELECT l.price::text AS price, l.sold_at
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       WHERE i.species_id = $1 AND l.status = 'sold' AND l.sold_at IS NOT NULL
       ORDER BY l.sold_at DESC LIMIT 8`,
      [speciesId],
    );
    return {
      speciesId: r.id,
      name: r.name,
      spriteUrl: r.sprite_url ?? "",
      rarity: r.rarity,
      setId: r.set_id,
      setName: r.set_name,
      gameName: shopGameOf(r.id)?.name ?? "",
      memberExclusive: r.member_exclusive,
      baseHp: r.base_hp,
      baseAtk: r.base_atk,
      price: cardValue(
        r.rarity, 1, 0,
        r.price_usd != null ? Number(r.price_usd) : undefined,
        rate,
        r.market_price_coins != null ? Number(r.market_price_coins) : undefined,
      ),
      priceUsd: r.price_usd != null ? Number(r.price_usd) : null,
      owned: (ownedRes.rows[0] as unknown as { n: number }).n,
      listings: (listRes.rows as unknown as Array<{ id: number; price: string; seller_id: string }>).map((l) => ({
        id: l.id, price: Number(l.price), sellerId: l.seller_id,
      })),
      sales: (salesRes.rows as unknown as Array<{ price: string; sold_at: Date }>).map((s) => ({
        price: Number(s.price), soldAt: s.sold_at,
      })),
    };
  } catch {
    return null;
  }
}

/** Buy any catalog card at its server-computed system value (spec 6.36). */
export async function buySingleCardWeb(
  userId: string, speciesId: string,
): Promise<{ ok: true; code: string; price: number } | { ok: false; error: string }> {
  const res = await db().query(
    `SELECT rarity, member_exclusive, price_usd, market_price_coins
     FROM game_species WHERE id = $1 AND enabled`,
    [speciesId],
  );
  const r = res.rows[0] as unknown as {
    rarity: string; member_exclusive: boolean;
    price_usd: string | number | null; market_price_coins: string | number | null;
  } | undefined;
  if (!r) return { ok: false, error: "Thẻ này không còn bán." };
  if (r.member_exclusive) {
    const perks = await userPerksWeb(userId);
    if (!perks?.exclusivePets) {
      return { ok: false, error: "Thẻ độc quyền chỉ dành cho hội viên." };
    }
  }
  const rate = await getPriceCoinsPerUsd();
  const price = cardValue(
    r.rarity, 1, 0,
    r.price_usd != null ? Number(r.price_usd) : undefined,
    rate,
    r.market_price_coins != null ? Number(r.market_price_coins) : undefined,
  );
  return buySpeciesTx(userId, speciesId, price);
}
