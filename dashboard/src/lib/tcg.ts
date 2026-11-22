/**
 * Player-facing TCG queries (spec 6.23) — same PostgreSQL the bot
 * uses. Card display data comes from the generated manifest
 * (tools/card-forge) in src/data/tcg-cards.json.
 */
import { db } from "./db";
import manifest from "../data/tcg-cards.json";

export interface TcgCardInfo {
  slug: string;
  name: string;
  rarity: string;
  element: string;
  hp: number;
  types: string;
  number: string;
  evolvesTo: string;
  /** Card set id (spec 6.27) — "tuxemon" is the first set. */
  set: string;
}

export const TCG_CARDS = manifest as TcgCardInfo[];
export const cardInfo = (slug: string) => TCG_CARDS.find((c) => c.slug === slug);

export const BASE_VALUE: Record<string, number> = {
  Common: 50, Uncommon: 150, Rare: 500, Epic: 2000, Legendary: 9000, Mythical: 20000, Fabled: 50000,
};
export const BURN_SHARDS: Record<string, number> = {
  Common: 1, Uncommon: 3, Rare: 8, Epic: 25, Legendary: 80, Mythical: 150, Fabled: 300,
};
export const RARITY_VI: Record<string, string> = {
  Common: "Thường", Uncommon: "Ít gặp", Rare: "Hiếm", Epic: "Sử thi",
  Legendary: "Huyền thoại", Mythical: "Thần thoại", Fabled: "Truyền thuyết",
};

export interface MarketRow extends TcgCardInfo {
  floorPrice: number | null;
  listings: number;
  referenceValue: number;
  /** Real market stats from sold listings (null when no sales yet). */
  lastSold: number | null;
  avgSold: number | null;
  soldCount: number;
  /** % change of the 7-day average sold price vs the previous 7 days. */
  trendPct: number | null;
  /** Daily average sold prices over the last 30 days (oldest first),
   *  for the sparkline. Empty when there are no sales in the window. */
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

/** Catalog merged with live market floors + real sales statistics. */
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
  } catch {
    /* market tables absent before migration — show reference values */
  }
  return TCG_CARDS.map((c) => {
    const s = stats.get(c.slug);
    return {
      ...c,
      floorPrice: s?.floor ?? null,
      listings: s?.count ?? 0,
      referenceValue: BASE_VALUE[c.rarity] ?? 0,
      lastSold: s?.lastSold ?? null,
      avgSold: s?.avgSold ?? null,
      soldCount: s?.soldCount ?? 0,
      trendPct: s?.trendPct ?? null,
      spark: s?.spark ?? [],
    };
  });
}

export interface MarketSummary {
  openListings: number;
  openValue: number;
  soldCount: number;
  speciesListed: number;
  /** Whole-market average sold price change: last 7d vs previous 7d. */
  indexChangePct: number | null;
}

/** Whole-market headline numbers for the market page header. */
export async function marketSummary(): Promise<MarketSummary> {
  const empty: MarketSummary = { openListings: 0, openValue: 0, soldCount: 0, speciesListed: 0, indexChangePct: null };
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
    return {
      openListings: r.open_n ?? 0,
      openValue: Number.parseInt(r.open_value ?? "0", 10),
      soldCount: r.sold_n ?? 0,
      speciesListed: sp.rows[0]?.n ?? 0,
      indexChangePct: avg7 && prev7 ? Math.round(((avg7 - prev7) / prev7) * 1000) / 10 : null,
    };
  } catch {
    return empty;
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
}

export async function userInstances(userId: string): Promise<OwnedInstance[]> {
  try {
    const res = await db().query(
      `SELECT code, species_id, level, enhance, locked, favorite, obtained
       FROM tcg_instances WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId],
    );
    return res.rows.map((r) => ({
      code: r.code, speciesId: r.species_id, level: r.level, enhance: r.enhance,
      locked: r.locked, favorite: r.favorite, obtained: r.obtained,
    }));
  } catch {
    return [];
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

export async function openListings(limit = 60): Promise<
  { id: number; sellerId: string; price: number; instance: OwnedInstance }[]
> {
  try {
    const res = await db().query(
      `SELECT l.id::text AS id, l.seller_id, l.price::text AS price,
              i.code, i.species_id, i.level, i.enhance, i.locked, i.favorite, i.obtained
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       WHERE l.status = 'open' ORDER BY l.created_at DESC LIMIT $1`,
      [limit],
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10),
      sellerId: r.seller_id,
      price: Number.parseInt(r.price, 10),
      instance: {
        code: r.code, speciesId: r.species_id, level: r.level, enhance: r.enhance,
        locked: r.locked, favorite: r.favorite, obtained: r.obtained,
      },
    }));
  } catch {
    return [];
  }
}
