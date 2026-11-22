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
  return withTx(async (client) => {
    const paid = await adjustBalanceTx(
      client, userId, -item.price, "tcg-shop", `Mua thẻ ${speciesId} ở Shop (web)`,
    );
    if (!paid) return { ok: false as const, error: "Không đủ Coins." };
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = newInstanceCode();
      const res = await client.query(
        `INSERT INTO tcg_instances (code, user_id, species_id, obtained) VALUES ($1, $2, $3, 'shop')
         ON CONFLICT (code) DO NOTHING RETURNING code`,
        [code, userId, speciesId],
      );
      if (res.rows.length) return { ok: true as const, code, price: item.price };
    }
    throw new Error("could not allocate instance code");
  });
}
