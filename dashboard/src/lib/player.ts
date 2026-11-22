/**
 * Player-area data + actions (spec 6.24) — the /me surface writes to
 * the SAME PostgreSQL the bot reads, with the same rules the bot
 * enforces (one source of truth, two surfaces).
 */
import { db } from "./db";
import { BASE_VALUE } from "./tcg";

export interface PlayerProfile {
  gender: string;
  birthday: string | null;
  hobby: string;
  statusText: string;
}

export async function getProfile(userId: string): Promise<PlayerProfile> {
  try {
    const res = await db().query(
      `SELECT gender, birthday::text AS birthday, hobby, status_text FROM player_profiles WHERE user_id = $1`,
      [userId],
    );
    const r = res.rows[0];
    return r
      ? { gender: r.gender, birthday: r.birthday, hobby: r.hobby, statusText: r.status_text }
      : { gender: "", birthday: null, hobby: "", statusText: "" };
  } catch {
    return { gender: "", birthday: null, hobby: "", statusText: "" };
  }
}

export async function saveProfile(userId: string, p: PlayerProfile): Promise<void> {
  await db().query(
    `INSERT INTO player_profiles (user_id, gender, birthday, hobby, status_text, updated_at)
     VALUES ($1, $2, $3, $4, $5, now())
     ON CONFLICT (user_id) DO UPDATE SET gender = $2, birthday = $3, hobby = $4, status_text = $5, updated_at = now()`,
    [userId, p.gender.slice(0, 30), p.birthday, p.hobby.slice(0, 120), p.statusText.slice(0, 120)],
  );
}

/** Species ids the player owns at least one card of (dex v1 source). */
export async function dexOwnedSpecies(userId: string): Promise<Set<string>> {
  try {
    const res = await db().query<{ species_id: string }>(
      `SELECT DISTINCT species_id FROM tcg_instances WHERE user_id = $1`,
      [userId],
    );
    return new Set(res.rows.map((r) => r.species_id));
  } catch {
    return new Set();
  }
}

/** Per-instance Coins value — mirrors bot cardValueCoins (spec 6.24). */
export function cardValue(rarity: string, level: number, enhance: number): number {
  const base = BASE_VALUE[rarity] ?? 0;
  return Math.round(base * (1 + Math.max(0, level - 1) * 0.02 + Math.max(0, enhance) * 0.15));
}

export async function getSellRatePercent(): Promise<number> {
  try {
    const res = await db().query<{ value: { sellRatePercent?: number } }>(
      `SELECT value FROM bot_config WHERE key = 'tcg_config'`,
    );
    const v = res.rows[0]?.value?.sellRatePercent;
    return typeof v === "number" ? Math.min(100, Math.max(10, v)) : 60;
  } catch {
    return 60;
  }
}

type TxResult = { ok: true } | { ok: false; error: string };

async function adjustBalanceTx(
  client: { query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, string>[] }> },
  userId: string,
  delta: number,
  source: string,
  note: string,
): Promise<boolean> {
  await client.query(
    `INSERT INTO economy_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
  const res = await client.query(
    `SELECT balance::text AS balance FROM economy_accounts WHERE user_id = $1 FOR UPDATE`,
    [userId],
  );
  const current = Number.parseInt(res.rows[0]?.balance ?? "0", 10);
  const next = current + delta;
  if (next < 0) return false;
  await client.query(`UPDATE economy_accounts SET balance = $2, updated_at = now() WHERE user_id = $1`, [
    userId,
    next,
  ]);
  await client.query(
    `INSERT INTO economy_ledger (user_id, delta, balance_after, source, note) VALUES ($1, $2, $3, $4, $5)`,
    [userId, delta, next, source, note.slice(0, 200)],
  );
  return true;
}

/** Sell a card to the system — same guards as the bot (spec 6.24). */
export async function sellCardWeb(userId: string, code: string): Promise<TxResult & { coins?: number }> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const inst = await client.query(
      `SELECT i.species_id, i.level, i.enhance, i.locked, i.favorite, s.rarity
       FROM tcg_instances i LEFT JOIN game_species s ON s.id = i.species_id
       WHERE i.code = $1 AND i.user_id = $2 FOR UPDATE OF i`,
      [code, userId],
    );
    const row = inst.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy thẻ đó trong kho của bạn." }; }
    if (row.locked) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đang khoá — mở khoá trong Discord trước." }; }
    if (row.favorite) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đang đánh dấu yêu thích — bỏ yêu thích trước." }; }
    const inDeck = await client.query(`SELECT 1 FROM tcg_deck_cards WHERE instance_code = $1`, [code]);
    if (inDeck.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đang nằm trong bộ bài — gỡ khỏi bộ bài trước." }; }
    const listed = await client.query(
      `SELECT 1 FROM tcg_listings WHERE instance_code = $1 AND status = 'open'`, [code],
    );
    if (listed.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đang bán trên chợ — huỷ tin đăng trước." }; }
    const rate = await getSellRatePercent();
    const value = cardValue(row.rarity ?? "Common", row.level, row.enhance);
    const coins = Math.max(1, Math.floor((value * rate) / 100));
    await client.query(`DELETE FROM tcg_instances WHERE code = $1`, [code]);
    await adjustBalanceTx(client, userId, coins, "tcg-sell", `Bán thẻ ${code} (web)`);
    await client.query("COMMIT");
    return { ok: true, coins };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi bán thẻ, thử lại sau." };
  } finally {
    client.release();
  }
}

/** The seller's market fee %: the TCG base fee (5) or their lower
 *  membership fee when they hold an active tier (spec 6.19). */
async function sellerFeePercent(sellerId: string): Promise<number> {
  try {
    const { getUserMembership, getBotConfig } = await import("@/lib/db");
    const { normalizeMembershipTiers, effectivePerksWeb } = await import("@/lib/membership");
    const m = await getUserMembership(sellerId);
    if (!m || !m.active) return 5;
    const tiers = normalizeMembershipTiers(await getBotConfig("membership_tiers"));
    const perks = effectivePerksWeb(tiers, m.tier_id);
    return perks ? Math.min(5, perks.marketFeePercent) : 5;
  } catch {
    return 5;
  }
}

/** Buy an open market listing — mirrors the bot market (fee by the
 *  seller's membership, base 5%). */
export async function buyListingWeb(buyerId: string, listingId: number): Promise<TxResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `SELECT seller_id, instance_code, price::text AS price FROM tcg_listings
       WHERE id = $1 AND status = 'open' FOR UPDATE`,
      [listingId],
    );
    const row = res.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { ok: false, error: "Tin bán này không còn nữa." }; }
    if (row.seller_id === buyerId) { await client.query("ROLLBACK"); return { ok: false, error: "Không mua được tin bán của chính mình." }; }
    const price = Number.parseInt(row.price, 10);
    const paid = await adjustBalanceTx(client, buyerId, -price, "tcg-market", `Mua thẻ ${row.instance_code} (web)`);
    if (!paid) { await client.query("ROLLBACK"); return { ok: false, error: "Số dư Coins không đủ." }; }
    const feePct = await sellerFeePercent(row.seller_id);
    const sellerGets = price - Math.floor((price * feePct) / 100);
    await adjustBalanceTx(client, row.seller_id, sellerGets, "tcg-market", `Bán thẻ ${row.instance_code} (web)`);
    await client.query(`UPDATE tcg_instances SET user_id = $1 WHERE code = $2`, [buyerId, row.instance_code]);
    await client.query(
      `UPDATE tcg_listings SET status = 'sold', buyer_id = $1, sold_at = now() WHERE id = $2`,
      [buyerId, listingId],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi mua, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function cancelListingWeb(userId: string, listingId: number): Promise<TxResult> {
  const res = await db().query(
    `UPDATE tcg_listings SET status = 'cancelled' WHERE id = $1 AND seller_id = $2 AND status = 'open'`,
    [listingId, userId],
  );
  return res.rowCount ? { ok: true } : { ok: false, error: "Không huỷ được tin này." };
}

export async function createListingWeb(userId: string, code: string, price: number): Promise<TxResult> {
  if (!Number.isInteger(price) || price < 10) return { ok: false, error: "Giá bán tối thiểu 10 Coins." };
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const inst = await client.query(
      `SELECT locked, favorite FROM tcg_instances WHERE code = $1 AND user_id = $2 FOR UPDATE`,
      [code, userId],
    );
    const row = inst.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy thẻ đó trong kho của bạn." }; }
    if (row.locked || row.favorite) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ khoá/yêu thích không đăng bán được." }; }
    const inDeck = await client.query(`SELECT 1 FROM tcg_deck_cards WHERE instance_code = $1`, [code]);
    if (inDeck.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đang trong bộ bài — gỡ ra trước khi bán." }; }
    const listed = await client.query(
      `SELECT 1 FROM tcg_listings WHERE instance_code = $1 AND status = 'open'`, [code],
    );
    if (listed.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đã có tin bán rồi." }; }
    await client.query(
      `INSERT INTO tcg_listings (seller_id, instance_code, price) VALUES ($1, $2, $3)`,
      [userId, code, price],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi đăng bán, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function setActiveDeckWeb(userId: string, deckId: number): Promise<TxResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const own = await client.query(`SELECT 1 FROM tcg_decks WHERE id = $1 AND user_id = $2`, [deckId, userId]);
    if (!own.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy bộ bài đó." }; }
    await client.query(`UPDATE tcg_decks SET is_active = false WHERE user_id = $1`, [userId]);
    await client.query(`UPDATE tcg_decks SET is_active = true WHERE id = $1`, [deckId]);
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function editDeckWeb(
  userId: string,
  deckId: number,
  action: "add" | "remove",
  code: string,
): Promise<TxResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const own = await client.query(`SELECT 1 FROM tcg_decks WHERE id = $1 AND user_id = $2`, [deckId, userId]);
    if (!own.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy bộ bài đó." }; }
    if (action === "remove") {
      await client.query(`DELETE FROM tcg_deck_cards WHERE deck_id = $1 AND instance_code = $2`, [deckId, code]);
    } else {
      const inst = await client.query(
        `SELECT 1 FROM tcg_instances WHERE code = $1 AND user_id = $2`, [code, userId],
      );
      if (!inst.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đó không có trong kho của bạn." }; }
      const count = await client.query(
        `SELECT COUNT(*)::int AS n FROM tcg_deck_cards WHERE deck_id = $1`, [deckId],
      );
      if ((count.rows[0]?.n ?? 0) >= 30) { await client.query("ROLLBACK"); return { ok: false, error: "Bộ bài đã đủ 30 thẻ." }; }
      await client.query(
        `INSERT INTO tcg_deck_cards (deck_id, instance_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [deckId, code],
      );
    }
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}

export interface TradeRow {
  id: number;
  fromUser: string;
  toUser: string;
  offerCodes: string[];
  offerCoins: number;
  status: string;
}

export async function listTradesFor(userId: string): Promise<{ incoming: TradeRow[]; outgoing: TradeRow[] }> {
  try {
    const res = await db().query(
      `SELECT id::text AS id, from_user, to_user, offer_codes,
              offer_coins::text AS offer_coins, status
       FROM tcg_trades WHERE from_user = $1 OR to_user = $1 ORDER BY created_at DESC LIMIT 40`,
      [userId],
    );
    const rows: TradeRow[] = res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10),
      fromUser: r.from_user,
      toUser: r.to_user,
      offerCodes: r.offer_codes ?? [],
      offerCoins: Number.parseInt(r.offer_coins, 10),
      status: r.status,
    }));
    return {
      incoming: rows.filter((r) => r.toUser === userId),
      outgoing: rows.filter((r) => r.fromUser === userId),
    };
  } catch {
    return { incoming: [], outgoing: [] };
  }
}

/** Accept/reject an incoming offer — full re-validation in one tx.
 *  A trade is one-directional (spec 6.23): the proposer gives cards +
 *  Coins; accepting receives them. */
export async function answerTradeWeb(userId: string, tradeId: number, accept: boolean): Promise<TxResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `SELECT from_user, offer_codes, offer_coins::text AS oc
       FROM tcg_trades WHERE id = $1 AND to_user = $2 AND status = 'pending' FOR UPDATE`,
      [tradeId, userId],
    );
    const row = res.rows[0];
    if (!row) { await client.query("ROLLBACK"); return { ok: false, error: "Lời đề nghị này không còn chờ nữa." }; }
    if (!accept) {
      await client.query(`UPDATE tcg_trades SET status = 'rejected', resolved_at = now() WHERE id = $1`, [tradeId]);
      await client.query("COMMIT");
      return { ok: true };
    }
    const offerCodes: string[] = row.offer_codes ?? [];
    const offerCoins = Number.parseInt(row.oc, 10);
    if (offerCodes.length) {
      const owned = await client.query(
        `SELECT code FROM tcg_instances WHERE code = ANY($1) AND user_id = $2`, [offerCodes, row.from_user],
      );
      if (owned.rows.length !== offerCodes.length) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Người gửi đã không còn giữ đủ thẻ trong đề nghị." };
      }
      const blocked = await client.query(
        `SELECT 1 FROM tcg_instances WHERE code = ANY($1) AND (locked OR favorite)`, [offerCodes],
      );
      const inDeck = await client.query(
        `SELECT 1 FROM tcg_deck_cards WHERE instance_code = ANY($1)`, [offerCodes],
      );
      const listed = await client.query(
        `SELECT 1 FROM tcg_listings WHERE instance_code = ANY($1) AND status = 'open'`, [offerCodes],
      );
      if (blocked.rows.length || inDeck.rows.length || listed.rows.length) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Một thẻ trong đề nghị đang khoá/nằm trong bộ bài/đang bán — không nhận được." };
      }
    }
    if (offerCoins > 0) {
      const paid = await adjustBalanceTx(client, row.from_user, -offerCoins, "tcg-trade", `Trao đổi #${tradeId} (web)`);
      if (!paid) { await client.query("ROLLBACK"); return { ok: false, error: "Người gửi không đủ Coins nữa." }; }
      await adjustBalanceTx(client, userId, offerCoins, "tcg-trade", `Trao đổi #${tradeId} (web)`);
    }
    for (const code of offerCodes) {
      await client.query(`UPDATE tcg_instances SET user_id = $1 WHERE code = $2`, [userId, code]);
    }
    await client.query(`UPDATE tcg_trades SET status = 'accepted', resolved_at = now() WHERE id = $1`, [tradeId]);
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi xử lý đề nghị, thử lại sau." };
  } finally {
    client.release();
  }
}
