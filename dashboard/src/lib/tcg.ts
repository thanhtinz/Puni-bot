/**
 * Player-facing TCG queries (spec 6.23) — same PostgreSQL the bot
 * uses. Card display data (name, rarity, artwork) comes straight from
 * game_species: sprite_url is the per-family artwork (local /op/*.jpg
 * for One Piece, the TCGplayer CDN for the other APITCG families).
 * The old generated Tuxemon manifest is gone (spec 6.29).
 */
import { db } from "./db";

export interface SpeciesDisplay {
  id: string;
  name: string;
  rarity: string;
  spriteUrl: string;
  setId: string;
  setName: string;
}

/** Display data for a batch of species ids (names for banner
 *  rate-ups, dex grids, anywhere only ids are stored). */
export async function speciesDisplay(ids: string[]): Promise<Map<string, SpeciesDisplay>> {
  const out = new Map<string, SpeciesDisplay>();
  if (!ids.length) return out;
  try {
    const res = await db().query(
      `SELECT s.id, s.name, s.rarity, s.sprite_url, s.set_id, COALESCE(g.name, s.set_id) AS set_name
       FROM game_species s LEFT JOIN game_sets g ON g.id = s.set_id
       WHERE s.id = ANY($1)`,
      [ids],
    );
    for (const r of res.rows) {
      out.set(r.id, {
        id: r.id, name: r.name ?? r.id, rarity: r.rarity ?? "Common",
        spriteUrl: r.sprite_url ?? "", setId: r.set_id ?? "",
        setName: r.set_name ?? r.set_id ?? "",
      });
    }
  } catch { /* display data is best-effort */ }
  return out;
}

export const BASE_VALUE: Record<string, number> = {
  Common: 50, Uncommon: 150, Rare: 500, Epic: 2000, Legendary: 9000, Mythical: 20000, Fabled: 50000,
};
export const BURN_SHARDS: Record<string, number> = {
  Common: 1, Uncommon: 3, Rare: 8, Epic: 25, Legendary: 80, Mythical: 150, Fabled: 300,
};
/** Default Coins per 1 USD of imported price (spec 6.29). */
export const DEFAULT_PRICE_COINS_PER_USD = 1;

export async function getPriceCoinsPerUsd(): Promise<number> {
  try {
    const res = await db().query<{ value: { priceCoinsPerUsd?: number } }>(
      `SELECT value FROM bot_config WHERE key = 'tcg_config'`,
    );
    const v = res.rows[0]?.value?.priceCoinsPerUsd;
    return typeof v === "number" ? Math.min(1_000_000, Math.max(1, v)) : DEFAULT_PRICE_COINS_PER_USD;
  } catch {
    return DEFAULT_PRICE_COINS_PER_USD;
  }
}

/** Reference value resolution (spec 6.29): internal market price,
 * then the imported starting price, then the rarity table. */
export function resolveReference(
  rarity: string,
  priceUsd: number | null,
  marketPriceCoins: number | null,
  coinsPerUsd: number,
): number {
  if (marketPriceCoins != null && marketPriceCoins > 0) return marketPriceCoins;
  if (priceUsd != null && priceUsd > 0) return priceUsd * coinsPerUsd;
  return BASE_VALUE[rarity] ?? 0;
}

export const RARITY_VI: Record<string, string> = {
  Common: "Thường", Uncommon: "Ít gặp", Rare: "Hiếm", Epic: "Sử thi",
  Legendary: "Huyền thoại", Mythical: "Thần thoại", Fabled: "Truyền thuyết",
};

export interface MarketRow {
  speciesId: string;
  name: string;
  rarity: string;
  set: string;
  spriteUrl: string;
  hp: number;
  atk: number;
  floorPrice: number | null;
  listings: number;
  /** Resolved reference: internal market price, else imported price,
   * else the rarity table (spec 6.29). */
  referenceValue: number;
  /** Internal market price when the species has traded, else null. */
  marketPrice: number | null;
  lastSold: number | null;
  avgSold: number | null;
  soldCount: number;
  /** % change of the 7-day average sold price vs the previous 7 days. */
  trendPct: number | null;
  /** Price line: internal price history points (last 30), falling back
   * to daily average sold prices. Oldest first. */
  spark: number[];
}

interface MarketStat {
  floor: number | null;
  count: number;
  lastSold: number | null;
  avgSold: number | null;
  soldCount: number;
  trendPct: number | null;
  spark: number[];
}

/**
 * Market overview (spec 6.29): one row per species WITH market
 * activity (open listings, sales, or an internal price), built from
 * game_species — the full catalog is far too large to list, and a
 * species nobody trades has no market to show. All numbers come from
 * real tcg_listings / tcg_price_history rows.
 */
export async function marketOverview(): Promise<MarketRow[]> {
  const stats = new Map<string, MarketStat>();
  try {
    const res = await db().query(
      `SELECT i.species_id,
              MIN(l.price) FILTER (WHERE l.status = 'open')::text AS floor,
              COUNT(*) FILTER (WHERE l.status = 'open')::int AS open_n,
              COUNT(*) FILTER (WHERE l.status = 'sold')::int AS sold_n,
              AVG(l.price) FILTER (WHERE l.status = 'sold')::text AS avg_sold,
              AVG(l.price) FILTER (WHERE l.status = 'sold' AND l.sold_at > now() - interval '7 days')::text AS avg_7d,
              AVG(l.price) FILTER (WHERE l.status = 'sold' AND l.sold_at <= now() - interval '7 days'
                                    AND l.sold_at > now() - interval '14 days')::text AS avg_prev7d,
              (SELECT l2.price::text FROM tcg_listings l2
                 JOIN tcg_instances i2 ON i2.code = l2.instance_code
                WHERE i2.species_id = i.species_id AND l2.status = 'sold'
                ORDER BY l2.sold_at DESC LIMIT 1) AS last_sold
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       GROUP BY i.species_id`,
    );
    for (const r of res.rows) {
      const avg7 = r.avg_7d ? Number.parseFloat(r.avg_7d) : null;
      const prev7 = r.avg_prev7d ? Number.parseFloat(r.avg_prev7d) : null;
      stats.set(r.species_id, {
        floor: r.floor ? Number.parseInt(r.floor, 10) : null,
        count: r.open_n ?? 0,
        lastSold: r.last_sold ? Number.parseInt(r.last_sold, 10) : null,
        avgSold: r.avg_sold ? Math.round(Number.parseFloat(r.avg_sold)) : null,
        soldCount: r.sold_n ?? 0,
        trendPct: avg7 && prev7 ? Math.round(((avg7 - prev7) / prev7) * 1000) / 10 : null,
        spark: [],
      });
    }
    const sparkRes = await db().query(
      `SELECT i.species_id, date_trunc('day', l.sold_at) AS day, AVG(l.price)::text AS avg_price
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       WHERE l.status = 'sold' AND l.sold_at > now() - interval '30 days'
       GROUP BY i.species_id, day ORDER BY day`,
    );
    for (const r of sparkRes.rows) {
      const s = stats.get(r.species_id);
      if (s) s.spark.push(Math.round(Number.parseFloat(r.avg_price)));
    }
    // Internal price history is the market's own price line (spec 6.29):
    // it wins over the sparse daily-sale averages when it has points.
    const histRes = await db().query(
      `SELECT species_id, price::text AS price FROM tcg_price_history
       WHERE created_at > now() - interval '30 days' ORDER BY created_at`,
    );
    const hist = new Map<string, number[]>();
    for (const r of histRes.rows) {
      const list = hist.get(r.species_id) ?? [];
      list.push(Number.parseFloat(r.price));
      hist.set(r.species_id, list);
    }
    for (const [sid, points] of hist) {
      const s = stats.get(sid) ?? { floor: null, count: 0, lastSold: null, avgSold: null, soldCount: 0, trendPct: null, spark: [] };
      if (points.length >= 2) s.spark = points.slice(-30);
      stats.set(sid, s);
    }
  } catch {
    /* market tables absent before migration — empty overview */
  }
  if (!stats.size) return [];
  const rate = await getPriceCoinsPerUsd();
  try {
    const ids = [...stats.keys()];
    const res = await db().query(
      `SELECT id, name, rarity, set_id, sprite_url, base_hp, base_atk,
              price_usd::text AS price_usd, market_price_coins::text AS market_price_coins
       FROM game_species WHERE id = ANY($1)`,
      [ids],
    );
    return res.rows.map((r) => {
      const s = stats.get(r.id)!;
      const priceUsd = r.price_usd != null ? Number.parseFloat(r.price_usd) : null;
      const marketPrice = r.market_price_coins != null ? Number.parseFloat(r.market_price_coins) : null;
      return {
        speciesId: r.id,
        name: r.name,
        rarity: r.rarity,
        set: r.set_id,
        spriteUrl: r.sprite_url ?? "",
        hp: r.base_hp ?? 0,
        atk: r.base_atk ?? 0,
        floorPrice: s.floor,
        listings: s.count,
        referenceValue: resolveReference(r.rarity, priceUsd, marketPrice, rate),
        marketPrice,
        lastSold: s.lastSold,
        avgSold: s.avgSold,
        soldCount: s.soldCount,
        trendPct: s.trendPct,
        spark: s.spark,
      };
    });
  } catch {
    return [];
  }
}

export interface MarketSummary {
  openListings: number;
  openValue: number;
  soldCount: number;
  speciesListed: number;
  /** Whole-market average sold price change: last 7d vs previous 7d. */
  indexChangePct: number | null;
  /** Coins volume traded in the last 7 days + its trade count. */
  volume7d: number;
  trades7d: number;
  /** All-time traded volume in Coins. */
  volumeAll: number;
  /** Highest completed sale ever (price + species name). */
  topSale: { price: number; speciesName: string } | null;
  /** Species whose price is already set by the internal market. */
  internalPriced: number;
  /** Distinct species ever traded. */
  speciesTraded: number;
}

/** Whole-market headline numbers for the market page header. */
export async function marketSummary(): Promise<MarketSummary> {
  const empty: MarketSummary = {
    openListings: 0, openValue: 0, soldCount: 0, speciesListed: 0, indexChangePct: null,
    volume7d: 0, trades7d: 0, volumeAll: 0, topSale: null, internalPriced: 0, speciesTraded: 0,
  };
  try {
    const res = await db().query(
      `SELECT COUNT(*) FILTER (WHERE status = 'open')::int AS open_n,
              COALESCE(SUM(price) FILTER (WHERE status = 'open'), 0)::text AS open_value,
              COUNT(*) FILTER (WHERE status = 'sold')::int AS sold_n,
              AVG(price) FILTER (WHERE status = 'sold' AND sold_at > now() - interval '7 days')::text AS avg_7d,
              AVG(price) FILTER (WHERE status = 'sold' AND sold_at <= now() - interval '7 days'
                                  AND sold_at > now() - interval '14 days')::text AS avg_prev7d
       FROM tcg_listings`,
    );
    const sp = await db().query(
      `SELECT COUNT(DISTINCT i.species_id)::int AS n
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       WHERE l.status = 'open'`,
    );
    const r = res.rows[0];
    const avg7 = r.avg_7d ? Number.parseFloat(r.avg_7d) : null;
    const prev7 = r.avg_prev7d ? Number.parseFloat(r.avg_prev7d) : null;
    const vol = await db().query(
      `SELECT COALESCE(SUM(price) FILTER (WHERE sold_at > now() - interval '7 days'), 0)::text AS vol_7d,
              COUNT(*) FILTER (WHERE sold_at > now() - interval '7 days')::int AS trades_7d,
              COALESCE(SUM(price), 0)::text AS vol_all,
              MAX(price)::text AS top_price
       FROM tcg_listings WHERE status = 'sold'`,
    );
    const v = vol.rows[0] ?? {};
    let topSale: MarketSummary["topSale"] = null;
    if (v.top_price) {
      const top = await db().query(
        `SELECT s.name AS species_name FROM tcg_listings l
         JOIN tcg_instances i ON i.code = l.instance_code
         LEFT JOIN game_species s ON s.id = i.species_id
         WHERE l.status = 'sold' AND l.price = $1 ORDER BY l.sold_at DESC LIMIT 1`,
        [v.top_price],
      );
      topSale = { price: Number.parseInt(v.top_price, 10), speciesName: top.rows[0]?.species_name ?? "—" };
    }
    const internal = await db().query(
      `SELECT (SELECT COUNT(*)::int FROM game_species WHERE market_price_coins IS NOT NULL) AS internal_n,
              (SELECT COUNT(DISTINCT i.species_id)::int FROM tcg_listings l
                JOIN tcg_instances i ON i.code = l.instance_code WHERE l.status = 'sold') AS traded_n`,
    ).catch(() => ({ rows: [{ internal_n: 0, traded_n: 0 }] }));
    return {
      openListings: r.open_n ?? 0,
      openValue: Number.parseInt(r.open_value ?? "0", 10),
      soldCount: r.sold_n ?? 0,
      speciesListed: sp.rows[0]?.n ?? 0,
      indexChangePct: avg7 && prev7 ? Math.round(((avg7 - prev7) / prev7) * 1000) / 10 : null,
      volume7d: Number.parseInt(v.vol_7d ?? "0", 10),
      trades7d: v.trades_7d ?? 0,
      volumeAll: Number.parseInt(v.vol_all ?? "0", 10),
      topSale,
      internalPriced: internal.rows[0]?.internal_n ?? 0,
      speciesTraded: internal.rows[0]?.traded_n ?? 0,
    };
  } catch {
    return empty;
  }
}

/**
 * Whole-market price line for the last 30 days: the daily average of
 * internal reference prices (tcg_price_history); when that is too
 * sparse, the daily average completed-sale price. Values only —
 * the chart is decorative-summary, the numbers beside it are exact.
 */
export async function marketIndexSeries(): Promise<{ points: number[]; changePct: number | null }> {
  try {
    // Chain-linked index (base 100), the way real market indices work:
    // each day contributes the AVERAGE per-species price change of the
    // species that actually moved that day, so a cheap species trading
    // for the first time cannot yank the line the way a raw average of
    // price levels would.
    const res = await db().query(
      `SELECT species_id, date_trunc('day', created_at) AS day, price::text AS price
       FROM tcg_price_history WHERE created_at > now() - interval '30 days'
       ORDER BY species_id, created_at`,
    );
    const lastBySpecies = new Map<string, { day: string; price: number }>();
    const changeByDay = new Map<string, number[]>();
    for (const r of res.rows) {
      const price = Number.parseFloat(r.price);
      const day = new Date(r.day as string).toISOString().slice(0, 10);
      const prev = lastBySpecies.get(r.species_id as string);
      if (prev && prev.day !== day && prev.price > 0) {
        const list = changeByDay.get(day) ?? [];
        list.push((price - prev.price) / prev.price);
        changeByDay.set(day, list);
      }
      lastBySpecies.set(r.species_id as string, { day, price });
    }
    const days = [...changeByDay.keys()].sort();
    if (days.length < 1) return { points: [], changePct: null };
    const points = [100];
    for (const d of days) {
      const changes = changeByDay.get(d)!;
      const avg = changes.reduce((a, b) => a + b, 0) / changes.length;
      points.push(Math.round(points[points.length - 1] * (1 + avg) * 100) / 100);
    }
    const first = points[0], last = points[points.length - 1];
    return { points, changePct: Math.round(((last - first) / first) * 1000) / 10 };
  } catch {
    return { points: [], changePct: null };
  }
}

export interface OwnedInstance {
  code: string;
  speciesId: string;
  level: number;
  enhance: number;
  locked: boolean;
  favorite: boolean;
  obtained: string;
  name: string;
  rarity: string;
  spriteUrl: string;
  setId: string;
  priceUsd?: number;
  marketPriceCoins?: number;
}

export async function userInstances(userId: string): Promise<OwnedInstance[]> {
  try {
    const res = await db().query(
      `SELECT i.code, i.species_id, i.level, i.enhance, i.locked, i.favorite, i.obtained,
              s.name AS sp_name, s.rarity AS sp_rarity, s.sprite_url, s.set_id,
              s.price_usd, s.market_price_coins
       FROM tcg_instances i LEFT JOIN game_species s ON s.id = i.species_id
       WHERE i.user_id = $1 ORDER BY i.created_at DESC`,
      [userId],
    );
    return res.rows.map((r) => ({
      code: r.code, speciesId: r.species_id, level: r.level, enhance: r.enhance,
      locked: r.locked, favorite: r.favorite, obtained: r.obtained,
      name: r.sp_name ?? r.species_id, rarity: r.sp_rarity ?? "Common",
      spriteUrl: r.sprite_url ?? "", setId: r.set_id ?? "",
      priceUsd: r.price_usd != null ? Number(r.price_usd) : undefined,
      marketPriceCoins: r.market_price_coins != null ? Number(r.market_price_coins) : undefined,
    }));
  } catch {
    return [];
  }
}

/** Dex: every set that actually holds species, biggest first. */
export async function dexSets(): Promise<{ id: string; name: string; count: number }[]> {
  try {
    const res = await db().query(
      `SELECT s.set_id AS id, COALESCE(g.name, s.set_id) AS name, COUNT(*)::int AS count
       FROM game_species s LEFT JOIN game_sets g ON g.id = s.set_id
       GROUP BY s.set_id, g.name ORDER BY count DESC, s.set_id`,
    );
    return res.rows.map((r) => ({ id: r.id, name: r.name, count: Number(r.count) }));
  } catch {
    return [];
  }
}

export async function dexSpeciesPage(setId: string, limit: number, offset: number): Promise<SpeciesDisplay[]> {
  try {
    const res = await db().query(
      `SELECT s.id, s.name, s.rarity, s.sprite_url, s.set_id, COALESCE(g.name, s.set_id) AS set_name
       FROM game_species s LEFT JOIN game_sets g ON g.id = s.set_id
       WHERE s.set_id = $1 ORDER BY s.id LIMIT $2 OFFSET $3`,
      [setId, limit, offset],
    );
    return res.rows.map((r) => ({
      id: r.id, name: r.name ?? r.id, rarity: r.rarity ?? "Common",
      spriteUrl: r.sprite_url ?? "", setId: r.set_id ?? "", setName: r.set_name ?? "",
    }));
  } catch {
    return [];
  }
}

/** All species ids of one set (ids only — for dex progress math). */
export async function dexSetSpeciesIds(setId: string): Promise<string[]> {
  try {
    const res = await db().query(`SELECT id FROM game_species WHERE set_id = $1`, [setId]);
    return res.rows.map((r) => r.id as string);
  } catch {
    return [];
  }
}

export async function dexTotalSpecies(): Promise<number> {
  try {
    const res = await db().query(`SELECT COUNT(*)::int AS n FROM game_species`);
    return Number(res.rows[0]?.n ?? 0);
  } catch {
    return 0;
  }
}

export async function userWallet(userId: string): Promise<{ shards: number; packsStandard: number; packsPremium: number }> {
  try {
    const res = await db().query(
      `SELECT shards::text AS shards, packs_standard, packs_premium FROM tcg_wallets WHERE user_id = $1`,
      [userId],
    );
    const r = res.rows[0];
    return r
      ? { shards: Number.parseInt(r.shards, 10), packsStandard: r.packs_standard, packsPremium: r.packs_premium }
      : { shards: 0, packsStandard: 0, packsPremium: 0 };
  } catch {
    return { shards: 0, packsStandard: 0, packsPremium: 0 };
  }
}

export async function userDecks(userId: string): Promise<{ id: number; name: string; isActive: boolean; codes: string[] }[]> {
  try {
    const res = await db().query(
      `SELECT d.id::text AS id, d.name, d.is_active,
              COALESCE(array_agg(dc.instance_code) FILTER (WHERE dc.instance_code IS NOT NULL), '{}') AS codes
       FROM tcg_decks d LEFT JOIN tcg_deck_cards dc ON dc.deck_id = d.id
       WHERE d.user_id = $1 GROUP BY d.id ORDER BY d.id`,
      [userId],
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10), name: r.name, isActive: r.is_active, codes: r.codes ?? [],
    }));
  } catch {
    return [];
  }
}

export async function topCollectors(limit = 20): Promise<{ userId: string; species: number; instances: number }[]> {
  try {
    const res = await db().query(
      `SELECT user_id, COUNT(DISTINCT species_id)::int AS species, COUNT(*)::int AS instances
       FROM tcg_instances GROUP BY user_id ORDER BY species DESC, instances DESC LIMIT $1`,
      [limit],
    );
    return res.rows.map((r) => ({ userId: r.user_id, species: r.species, instances: r.instances }));
  } catch {
    return [];
  }
}

export interface OpenListing {
  id: number;
  sellerId: string;
  price: number;
  createdAt: string;
  instance: OwnedInstance;
  speciesName: string;
  rarity: string;
  spriteUrl: string;
  /** Resolved reference value of this species (spec 6.29). */
  referenceValue: number;
}

export async function openListings(limit = 60): Promise<OpenListing[]> {
  try {
    const rate = await getPriceCoinsPerUsd();
    const res = await db().query(
      `SELECT l.id::text AS id, l.seller_id, l.price::text AS price, l.created_at,
              i.code, i.species_id, i.level, i.enhance, i.locked, i.favorite, i.obtained,
              s.name AS species_name, s.rarity, s.sprite_url,
              s.price_usd::text AS price_usd, s.market_price_coins::text AS market_price_coins
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       LEFT JOIN game_species s ON s.id = i.species_id
       WHERE l.status = 'open' ORDER BY l.created_at DESC LIMIT $1`,
      [limit],
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10),
      sellerId: r.seller_id,
      price: Number.parseInt(r.price, 10),
      createdAt: r.created_at as string,
      instance: {
        code: r.code, speciesId: r.species_id, level: r.level, enhance: r.enhance,
        locked: r.locked, favorite: r.favorite, obtained: r.obtained,
        name: r.species_name ?? r.species_id, rarity: r.rarity ?? "Common",
        spriteUrl: r.sprite_url ?? "", setId: "",
      },
      speciesName: r.species_name ?? r.species_id,
      rarity: r.rarity ?? "Common",
      spriteUrl: r.sprite_url ?? "",
      referenceValue: resolveReference(
        r.rarity ?? "Common",
        r.price_usd != null ? Number.parseFloat(r.price_usd) : null,
        r.market_price_coins != null ? Number.parseFloat(r.market_price_coins) : null,
        rate,
      ),
    }));
  } catch {
    return [];
  }
}

export interface MarketHistoryRow {
  code: string;
  speciesId: string;
  speciesName: string;
  spriteUrl: string;
  price: number;
  at: string;
  otherId: string;
}

/** My completed market trades (spec 6.29): what I sold and bought. */
export async function myMarketHistory(userId: string, limit = 12): Promise<{ sold: MarketHistoryRow[]; bought: MarketHistoryRow[] }> {
  const mapRows = (rows: Record<string, unknown>[], other: "buyer_id" | "seller_id"): MarketHistoryRow[] =>
    rows.map((r) => ({
      code: r.code as string,
      speciesId: r.species_id as string,
      speciesName: (r.species_name as string) ?? (r.species_id as string),
      spriteUrl: (r.sprite_url as string) ?? "",
      price: Number.parseInt(r.price as string, 10),
      at: r.sold_at as string,
      otherId: r[other] as string,
    }));
  try {
    const base = `SELECT l.price::text AS price, l.sold_at, l.buyer_id, l.seller_id,
                         i.code, i.species_id, s.name AS species_name, s.sprite_url
                  FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
                  LEFT JOIN game_species s ON s.id = i.species_id
                  WHERE l.status = 'sold'`;
    const sold = await db().query(`${base} AND l.seller_id = $1 ORDER BY l.sold_at DESC LIMIT $2`, [userId, limit]);
    const bought = await db().query(`${base} AND l.buyer_id = $1 ORDER BY l.sold_at DESC LIMIT $2`, [userId, limit]);
    return { sold: mapRows(sold.rows, "buyer_id"), bought: mapRows(bought.rows, "seller_id") };
  } catch {
    return { sold: [], bought: [] };
  }
}
