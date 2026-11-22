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
}

/** Catalog merged with live market floors. */
export async function marketOverview(): Promise<MarketRow[]> {
  const floors = new Map<string, { floor: number; count: number }>();
  try {
    const res = await db().query<{ species_id: string; floor: string; n: string }>(
      `SELECT i.species_id, MIN(l.price)::text AS floor, COUNT(*)::text AS n
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       WHERE l.status = 'open' GROUP BY i.species_id`,
    );
    for (const r of res.rows) {
      floors.set(r.species_id, { floor: Number.parseInt(r.floor, 10), count: Number.parseInt(r.n, 10) });
    }
  } catch {
    /* market tables absent before migration — show reference values */
  }
  return TCG_CARDS.map((c) => ({
    ...c,
    floorPrice: floors.get(c.slug)?.floor ?? null,
    listings: floors.get(c.slug)?.count ?? 0,
    referenceValue: BASE_VALUE[c.rarity] ?? 0,
  }));
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
