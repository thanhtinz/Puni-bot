import { db } from "@/lib/db";

/**
 * Admin management for gacha banners (spec 6.38) — the tcg_banners
 * table the bot and the web gacha page both read live. Banner ids are
 * immutable once created (pity rows reference them); a banner with
 * pull history cannot be deleted, only disabled.
 */

export const BANNER_KINDS = ["standard", "limited", "event", "beginner"] as const;
export type BannerKind = (typeof BANNER_KINDS)[number];

export interface BannerAdminRow {
  id: string;
  name: string;
  kind: string;
  featuredSpecies: string[];
  poolSpecies: string[];
  poolPrefix: string | null;
  costCoins: number;
  startsAt: Date | null;
  endsAt: Date | null;
  imageUrl: string | null;
  enabled: boolean;
  pulls: number;
}

export interface BannerInput {
  name: string;
  kind: BannerKind;
  costCoins: number;
  poolPrefix: string | null;
  poolSpecies: string[];
  featuredSpecies: string[];
  imageUrl: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}

const SELECT = `
  SELECT b.id, b.name, b.kind, b.featured_species, b.pool_species, b.pool_prefix,
         b.cost_coins::text AS cost, b.starts_at, b.ends_at, b.image_url, b.enabled,
         (SELECT COUNT(*)::int FROM tcg_pulls p WHERE p.banner_id = b.id) AS pulls
  FROM tcg_banners b`;

function mapRow(r: Record<string, unknown>): BannerAdminRow {
  return {
    id: String(r.id),
    name: String(r.name),
    kind: String(r.kind),
    featuredSpecies: (r.featured_species as string[]) ?? [],
    poolSpecies: (r.pool_species as string[]) ?? [],
    poolPrefix: r.pool_prefix != null ? String(r.pool_prefix) : null,
    costCoins: Number.parseInt(String(r.cost), 10),
    startsAt: r.starts_at ? new Date(r.starts_at as string) : null,
    endsAt: r.ends_at ? new Date(r.ends_at as string) : null,
    imageUrl: r.image_url != null ? String(r.image_url) : null,
    enabled: Boolean(r.enabled),
    pulls: Number(r.pulls ?? 0),
  };
}

export async function listBannersAdmin(): Promise<BannerAdminRow[]> {
  const res = await db().query(`${SELECT} ORDER BY b.id`);
  return (res.rows as Record<string, unknown>[]).map(mapRow);
}

export async function getBannerAdmin(id: string): Promise<BannerAdminRow | null> {
  const res = await db().query(`${SELECT} WHERE b.id = $1`, [id]);
  return res.rows[0] ? mapRow(res.rows[0] as Record<string, unknown>) : null;
}

/** Which of the given species ids do not exist in the catalog. */
export async function missingSpecies(ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const res = await db().query(
    `SELECT id FROM game_species WHERE id = ANY($1)`, [ids],
  );
  const found = new Set((res.rows as { id: string }[]).map((r) => r.id));
  return ids.filter((id) => !found.has(id));
}

export async function createBanner(id: string, input: BannerInput): Promise<void> {
  await db().query(
    `INSERT INTO tcg_banners (id, name, kind, featured_species, pool_species, pool_prefix, cost_coins, starts_at, ends_at, image_url, enabled)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, TRUE)`,
    [id, input.name, input.kind, input.featuredSpecies, input.poolSpecies,
     input.poolPrefix, input.costCoins, input.startsAt, input.endsAt, input.imageUrl],
  );
}

export async function updateBanner(id: string, input: BannerInput): Promise<void> {
  await db().query(
    `UPDATE tcg_banners SET name = $2, kind = $3, featured_species = $4, pool_species = $5,
       pool_prefix = $6, cost_coins = $7, starts_at = $8, ends_at = $9, image_url = $10
     WHERE id = $1`,
    [id, input.name, input.kind, input.featuredSpecies, input.poolSpecies,
     input.poolPrefix, input.costCoins, input.startsAt, input.endsAt, input.imageUrl],
  );
}

export async function setBannerEnabled(id: string, enabled: boolean): Promise<void> {
  await db().query(`UPDATE tcg_banners SET enabled = $2 WHERE id = $1`, [id, enabled]);
}

/** Refuses when pull history exists (FK + audit trail) — disable instead. */
export async function deleteBanner(id: string): Promise<{ ok: boolean; error?: string }> {
  const pulls = await db().query(
    `SELECT COUNT(*)::int AS n FROM tcg_pulls WHERE banner_id = $1`, [id],
  );
  if (Number((pulls.rows[0] as { n: number }).n) > 0) {
    return { ok: false, error: "Banner đã có lượt mở — không xoá được, hãy tắt thay thế." };
  }
  await db().query(`DELETE FROM tcg_pity WHERE banner_id = $1`, [id]);
  await db().query(`DELETE FROM tcg_banners WHERE id = $1`, [id]);
  return { ok: true };
}
