import type { Pool } from "pg";
import { emptyPity, newInstanceCode, type CardInstance, type PityState, type TcgBanner, type TcgRarity } from "../services/tcg";
import type { Deck, Listing, PullRecord, TcgStore, TcgWallet, Trade } from "../services/tcg-store";

/** PostgreSQL TcgStore (spec 6.23, migration 0015). */
export class PgTcgStore implements TcgStore {
  constructor(private readonly pool: Pool) {}

  async listBanners(): Promise<TcgBanner[]> {
    const res = await this.pool.query(
      `SELECT id, name, kind, featured_species, pool_species, cost_coins::text AS cost, starts_at, ends_at, enabled FROM tcg_banners ORDER BY id`,
    );
    return res.rows.map((r) => ({
      id: r.id, name: r.name, kind: r.kind, featuredSpecies: r.featured_species ?? [],
      poolSpecies: r.pool_species ?? [], costCoins: Number.parseInt(r.cost, 10),
      startsAt: r.starts_at, endsAt: r.ends_at, enabled: r.enabled,
    }));
  }

  async getBanner(id: string): Promise<TcgBanner | null> {
    return (await this.listBanners()).find((b) => b.id === id) ?? null;
  }

  async getPity(userId: string, bannerId: string): Promise<PityState> {
    const res = await this.pool.query(
      `SELECT since_epic, since_legendary, total_pulls, summon_points FROM tcg_pity WHERE user_id = $1 AND banner_id = $2`,
      [userId, bannerId],
    );
    const r = res.rows[0];
    if (!r) return emptyPity();
    return { sinceEpic: r.since_epic, sinceLegendary: r.since_legendary, totalPulls: r.total_pulls, summonPoints: r.summon_points };
  }

  async savePity(userId: string, bannerId: string, pity: PityState): Promise<void> {
    await this.pool.query(
      `INSERT INTO tcg_pity (user_id, banner_id, since_epic, since_legendary, total_pulls, summon_points)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, banner_id) DO UPDATE SET
         since_epic = EXCLUDED.since_epic, since_legendary = EXCLUDED.since_legendary,
         total_pulls = EXCLUDED.total_pulls, summon_points = EXCLUDED.summon_points`,
      [userId, bannerId, pity.sinceEpic, pity.sinceLegendary, pity.totalPulls, pity.summonPoints],
    );
  }

  async totalPullsAll(userId: string): Promise<number> {
    const res = await this.pool.query<{ n: string }>(
      `SELECT COUNT(*)::text AS n FROM tcg_pulls WHERE user_id = $1`, [userId],
    );
    return Number.parseInt(res.rows[0]?.n ?? "0", 10);
  }

  async createInstance(userId: string, speciesId: string, obtained: string): Promise<CardInstance> {
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = newInstanceCode(Math.random);
      try {
        const res = await this.pool.query(
          `INSERT INTO tcg_instances (code, user_id, species_id, obtained) VALUES ($1, $2, $3, $4)
           RETURNING code, user_id, species_id, level, xp, enhance, locked, favorite, obtained, created_at`,
          [code, userId, speciesId, obtained],
        );
        const r = res.rows[0];
        return {
          code: r.code, userId: r.user_id, speciesId: r.species_id, level: r.level, xp: r.xp,
          enhance: r.enhance, locked: r.locked, favorite: r.favorite, obtained: r.obtained, createdAt: r.created_at,
        };
      } catch (err) {
        if ((err as { code?: string }).code !== "23505") throw err;
      }
    }
    throw new Error("could not allocate instance code");
  }

  async getInstance(code: string): Promise<CardInstance | null> {
    const res = await this.pool.query(
      `SELECT code, user_id, species_id, level, xp, enhance, locked, favorite, obtained, created_at
       FROM tcg_instances WHERE code = $1`, [code.toUpperCase()],
    );
    const r = res.rows[0];
    return r ? {
      code: r.code, userId: r.user_id, speciesId: r.species_id, level: r.level, xp: r.xp,
      enhance: r.enhance, locked: r.locked, favorite: r.favorite, obtained: r.obtained, createdAt: r.created_at,
    } : null;
  }

  async listInstances(userId: string): Promise<CardInstance[]> {
    const res = await this.pool.query(
      `SELECT code, user_id, species_id, level, xp, enhance, locked, favorite, obtained, created_at
       FROM tcg_instances WHERE user_id = $1 ORDER BY created_at DESC`, [userId],
    );
    return res.rows.map((r) => ({
      code: r.code, userId: r.user_id, speciesId: r.species_id, level: r.level, xp: r.xp,
      enhance: r.enhance, locked: r.locked, favorite: r.favorite, obtained: r.obtained, createdAt: r.created_at,
    }));
  }

  async updateInstance(code: string, patch: Partial<Pick<CardInstance, "level" | "xp" | "enhance" | "locked" | "favorite" | "userId">>): Promise<void> {
    const sets: string[] = [];
    const vals: unknown[] = [];
    const map: Record<string, string> = {
      level: "level", xp: "xp", enhance: "enhance", locked: "locked", favorite: "favorite", userId: "user_id",
    };
    for (const [k, v] of Object.entries(patch)) {
      if (v === undefined) continue;
      vals.push(v);
      sets.push(`${map[k]} = $${vals.length}`);
    }
    if (!sets.length) return;
    vals.push(code.toUpperCase());
    await this.pool.query(`UPDATE tcg_instances SET ${sets.join(", ")} WHERE code = $${vals.length}`, vals);
  }

  async deleteInstance(code: string): Promise<void> {
    await this.pool.query(`DELETE FROM tcg_instances WHERE code = $1`, [code.toUpperCase()]);
  }

  async recordPull(rec: PullRecord): Promise<void> {
    await this.pool.query(
      `INSERT INTO tcg_pulls (user_id, banner_id, species_id, rarity, instance_code) VALUES ($1, $2, $3, $4, $5)`,
      [rec.userId, rec.bannerId, rec.speciesId, rec.rarity, rec.instanceCode],
    );
  }

  async pullHistory(userId: string, limit: number): Promise<PullRecord[]> {
    const res = await this.pool.query(
      `SELECT user_id, banner_id, species_id, rarity, instance_code, created_at FROM tcg_pulls
       WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`, [userId, limit],
    );
    return res.rows.map((r) => ({
      userId: r.user_id, bannerId: r.banner_id, speciesId: r.species_id,
      rarity: r.rarity as TcgRarity, instanceCode: r.instance_code, at: r.created_at,
    }));
  }

  async wallet(userId: string): Promise<TcgWallet> {
    const res = await this.pool.query(
      `SELECT shards::text AS shards, packs_standard, packs_premium FROM tcg_wallets WHERE user_id = $1`, [userId],
    );
    const r = res.rows[0];
    return r
      ? { shards: Number.parseInt(r.shards, 10), packsStandard: r.packs_standard, packsPremium: r.packs_premium }
      : { shards: 0, packsStandard: 0, packsPremium: 0 };
  }

  async adjustWallet(userId: string, delta: Partial<TcgWallet>): Promise<TcgWallet> {
    const res = await this.pool.query(
      `INSERT INTO tcg_wallets (user_id, shards, packs_standard, packs_premium)
       VALUES ($1, GREATEST(0, $2), GREATEST(0, $3), GREATEST(0, $4))
       ON CONFLICT (user_id) DO UPDATE SET
         shards = GREATEST(0, tcg_wallets.shards + $2),
         packs_standard = GREATEST(0, tcg_wallets.packs_standard + $3),
         packs_premium = GREATEST(0, tcg_wallets.packs_premium + $4)
       RETURNING shards::text AS shards, packs_standard, packs_premium`,
      [userId, delta.shards ?? 0, delta.packsStandard ?? 0, delta.packsPremium ?? 0],
    );
    const r = res.rows[0];
    return { shards: Number.parseInt(r.shards, 10), packsStandard: r.packs_standard, packsPremium: r.packs_premium };
  }

  async claimOnce(userId: string, kind: "daily" | "weekly", period: string): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [userId, kind, period],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async listDecks(userId: string): Promise<Deck[]> {
    const res = await this.pool.query(
      `SELECT d.id::text AS id, d.user_id, d.name, d.is_active,
              COALESCE(array_agg(dc.instance_code) FILTER (WHERE dc.instance_code IS NOT NULL), '{}') AS codes
       FROM tcg_decks d LEFT JOIN tcg_deck_cards dc ON dc.deck_id = d.id
       WHERE d.user_id = $1 GROUP BY d.id ORDER BY d.id`, [userId],
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10), userId: r.user_id, name: r.name, isActive: r.is_active, codes: r.codes ?? [],
    }));
  }

  async createDeck(userId: string, name: string): Promise<Deck> {
    const res = await this.pool.query(
      `INSERT INTO tcg_decks (user_id, name) VALUES ($1, $2) RETURNING id::text AS id`,
      [userId, name],
    );
    return { id: Number.parseInt(res.rows[0].id, 10), userId, name, isActive: false, codes: [] };
  }

  async getDeck(id: number): Promise<Deck | null> {
    const res = await this.pool.query(
      `SELECT d.id::text AS id, d.user_id, d.name, d.is_active,
              COALESCE(array_agg(dc.instance_code) FILTER (WHERE dc.instance_code IS NOT NULL), '{}') AS codes
       FROM tcg_decks d LEFT JOIN tcg_deck_cards dc ON dc.deck_id = d.id
       WHERE d.id = $1 GROUP BY d.id`, [id],
    );
    const r = res.rows[0];
    return r ? { id: Number.parseInt(r.id, 10), userId: r.user_id, name: r.name, isActive: r.is_active, codes: r.codes ?? [] } : null;
  }

  async setDeckCards(deckId: number, codes: string[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`DELETE FROM tcg_deck_cards WHERE deck_id = $1`, [deckId]);
      for (const code of codes) {
        await client.query(`INSERT INTO tcg_deck_cards (deck_id, instance_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [deckId, code]);
      }
      await client.query("COMMIT");
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteDeck(id: number): Promise<void> {
    await this.pool.query(`DELETE FROM tcg_decks WHERE id = $1`, [id]);
  }

  async setActiveDeck(userId: string, deckId: number): Promise<void> {
    await this.pool.query(
      `UPDATE tcg_decks SET is_active = (id = $2) WHERE user_id = $1`, [userId, deckId],
    );
  }

  async createListing(sellerId: string, instanceCode: string, price: number): Promise<Listing> {
    const res = await this.pool.query(
      `INSERT INTO tcg_listings (seller_id, instance_code, price) VALUES ($1, $2, $3)
       RETURNING id::text AS id, created_at`,
      [sellerId, instanceCode.toUpperCase(), price],
    );
    return {
      id: Number.parseInt(res.rows[0].id, 10), sellerId, instanceCode: instanceCode.toUpperCase(),
      price, status: "open", buyerId: null, createdAt: res.rows[0].created_at,
    };
  }

  async getListing(id: number): Promise<Listing | null> {
    const res = await this.pool.query(
      `SELECT id::text AS id, seller_id, instance_code, price::text AS price, status, buyer_id, created_at
       FROM tcg_listings WHERE id = $1`, [id],
    );
    const r = res.rows[0];
    return r ? {
      id: Number.parseInt(r.id, 10), sellerId: r.seller_id, instanceCode: r.instance_code,
      price: Number.parseInt(r.price, 10), status: r.status, buyerId: r.buyer_id, createdAt: r.created_at,
    } : null;
  }

  async listOpenListings(): Promise<Listing[]> {
    const res = await this.pool.query(
      `SELECT id::text AS id, seller_id, instance_code, price::text AS price, status, buyer_id, created_at
       FROM tcg_listings WHERE status = 'open' ORDER BY price ASC LIMIT 200`,
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10), sellerId: r.seller_id, instanceCode: r.instance_code,
      price: Number.parseInt(r.price, 10), status: r.status as Listing["status"], buyerId: r.buyer_id, createdAt: r.created_at,
    }));
  }

  async closeListing(id: number, status: Listing["status"], buyerId?: string): Promise<void> {
    await this.pool.query(
      `UPDATE tcg_listings SET status = $2, buyer_id = $3, sold_at = CASE WHEN $2 = 'sold' THEN now() ELSE sold_at END WHERE id = $1`,
      [id, status, buyerId ?? null],
    );
  }

  async listingsOf(userId: string): Promise<Listing[]> {
    const res = await this.pool.query(
      `SELECT id::text AS id, seller_id, instance_code, price::text AS price, status, buyer_id, created_at
       FROM tcg_listings WHERE seller_id = $1 ORDER BY created_at DESC LIMIT 100`, [userId],
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10), sellerId: r.seller_id, instanceCode: r.instance_code,
      price: Number.parseInt(r.price, 10), status: r.status as Listing["status"], buyerId: r.buyer_id, createdAt: r.created_at,
    }));
  }

  async listingForInstance(code: string): Promise<Listing | null> {
    const res = await this.pool.query(
      `SELECT id::text AS id, seller_id, instance_code, price::text AS price, status, buyer_id, created_at
       FROM tcg_listings WHERE instance_code = $1 AND status = 'open'`, [code.toUpperCase()],
    );
    const r = res.rows[0];
    return r ? {
      id: Number.parseInt(r.id, 10), sellerId: r.seller_id, instanceCode: r.instance_code,
      price: Number.parseInt(r.price, 10), status: r.status as Listing["status"], buyerId: r.buyer_id, createdAt: r.created_at,
    } : null;
  }

  async createTrade(fromUser: string, toUser: string, codes: string[], coins: number): Promise<Trade> {
    const res = await this.pool.query(
      `INSERT INTO tcg_trades (from_user, to_user, offer_codes, offer_coins) VALUES ($1, $2, $3, $4)
       RETURNING id::text AS id, created_at`,
      [fromUser, toUser, codes.map((c) => c.toUpperCase()), coins],
    );
    return {
      id: Number.parseInt(res.rows[0].id, 10), fromUser, toUser,
      offerCodes: codes.map((c) => c.toUpperCase()), offerCoins: coins, status: "pending", createdAt: res.rows[0].created_at,
    };
  }

  async getTrade(id: number): Promise<Trade | null> {
    const res = await this.pool.query(
      `SELECT id::text AS id, from_user, to_user, offer_codes, offer_coins::text AS coins, status, created_at
       FROM tcg_trades WHERE id = $1`, [id],
    );
    const r = res.rows[0];
    return r ? {
      id: Number.parseInt(r.id, 10), fromUser: r.from_user, toUser: r.to_user, offerCodes: r.offer_codes ?? [],
      offerCoins: Number.parseInt(r.coins, 10), status: r.status as Trade["status"], createdAt: r.created_at,
    } : null;
  }

  async resolveTrade(id: number, status: Trade["status"]): Promise<void> {
    await this.pool.query(
      `UPDATE tcg_trades SET status = $2, resolved_at = now() WHERE id = $1`, [id, status],
    );
  }

  async tradeHistory(userId: string, limit: number): Promise<Trade[]> {
    const res = await this.pool.query(
      `SELECT id::text AS id, from_user, to_user, offer_codes, offer_coins::text AS coins, status, created_at
       FROM tcg_trades WHERE from_user = $1 OR to_user = $1 ORDER BY created_at DESC LIMIT $2`, [userId, limit],
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10), fromUser: r.from_user, toUser: r.to_user, offerCodes: r.offer_codes ?? [],
      offerCoins: Number.parseInt(r.coins, 10), status: r.status as Trade["status"], createdAt: r.created_at,
    }));
  }

  async claimedAchievements(userId: string): Promise<string[]> {
    const res = await this.pool.query(
      `SELECT achievement_id FROM tcg_achievements WHERE user_id = $1`, [userId],
    );
    return res.rows.map((r) => r.achievement_id as string);
  }

  async claimAchievement(userId: string, id: string): Promise<void> {
    await this.pool.query(
      `INSERT INTO tcg_achievements (user_id, achievement_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [userId, id],
    );
  }

  async getPrefs(userId: string): Promise<Record<string, unknown>> {
    const res = await this.pool.query(`SELECT prefs FROM tcg_settings WHERE user_id = $1`, [userId]);
    return (res.rows[0]?.prefs as Record<string, unknown>) ?? {};
  }

  async setPrefs(userId: string, prefs: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `INSERT INTO tcg_settings (user_id, prefs) VALUES ($1, $2::jsonb)
       ON CONFLICT (user_id) DO UPDATE SET prefs = EXCLUDED.prefs, updated_at = now()`,
      [userId, JSON.stringify(prefs)],
    );
  }

  async topCollectors(limit: number): Promise<{ userId: string; species: number; instances: number }[]> {
    const res = await this.pool.query(
      `SELECT user_id, COUNT(DISTINCT species_id)::int AS species, COUNT(*)::int AS instances
       FROM tcg_instances GROUP BY user_id ORDER BY species DESC, instances DESC LIMIT $1`, [limit],
    );
    return res.rows.map((r) => ({ userId: r.user_id, species: r.species, instances: r.instances }));
  }
}
