/**
 * Deck Search (spec 6.37) — public decks other players published from
 * the Bộ Bài page. Readers search by deck/author name, game family or
 * a contained card; adopting a deck rebuilds it from the adopter's OWN
 * instances (never copies the owner's cards) under the same deck
 * rules the bot enforces (deck slots = tcg_config.maxDecks + the
 * membership extraTeams perk; composition 30 cards / ≤3 per species
 * is guaranteed by the source deck's own validity).
 */
import { db, getBotConfig, getUserMembership } from "./db";
import { SHOP_GAMES, shopGameOf } from "./shop";
import { cardValue, fmtCoins } from "./player";
import { getPriceCoinsPerUsd } from "./tcg";
import { validateDeckWeb } from "./player-deck";
import { normalizeMembershipTiers, effectivePerksWeb } from "./membership";

export { fmtCoins };

export interface DeckSpeciesLine {
  speciesId: string;
  name: string;
  rarity: string;
  spriteUrl: string;
  setId: string;
  count: number;
  unitValue: number;
}

export interface PublicDeck {
  id: number;
  name: string;
  description: string;
  authorId: string;
  authorName: string;
  importCount: number;
  publishedAt: string | null;
  cardCount: number;
  speciesCount: number;
  totalValue: number;
  families: string[];
  lines: DeckSpeciesLine[];
}

const RARITY_RANK: Record<string, number> = {
  Fabled: 7, Mythical: 6, Legendary: 5, Epic: 4, Rare: 3, Uncommon: 2, Common: 1,
};

interface CompRow {
  deck_id: string;
  species_id: string;
  sp_name: string | null;
  sp_rarity: string | null;
  sprite_url: string | null;
  set_id: string | null;
  price_usd: string | null;
  market_price_coins: string | null;
  n: number;
}

async function compositions(deckIds: number[], rate: number): Promise<Map<number, DeckSpeciesLine[]>> {
  const out = new Map<number, DeckSpeciesLine[]>();
  if (!deckIds.length) return out;
  const res = await db().query<CompRow>(
    `SELECT dc.deck_id::text AS deck_id, i.species_id,
            s.name AS sp_name, s.rarity AS sp_rarity, s.sprite_url, s.set_id,
            s.price_usd::text AS price_usd, s.market_price_coins::text AS market_price_coins,
            COUNT(*)::int AS n
     FROM tcg_deck_cards dc
     JOIN tcg_instances i ON i.code = dc.instance_code
     LEFT JOIN game_species s ON s.id = i.species_id
     WHERE dc.deck_id = ANY($1::bigint[])
     GROUP BY dc.deck_id, i.species_id, s.name, s.rarity, s.sprite_url, s.set_id, s.price_usd, s.market_price_coins`,
    [deckIds],
  );
  for (const r of res.rows) {
    const line: DeckSpeciesLine = {
      speciesId: r.species_id,
      name: r.sp_name ?? r.species_id,
      rarity: r.sp_rarity ?? "Common",
      spriteUrl: r.sprite_url ?? "",
      setId: r.set_id ?? "",
      count: r.n,
      unitValue: cardValue(
        r.sp_rarity ?? "Common", 1, 0,
        r.price_usd != null ? Number(r.price_usd) : undefined,
        rate,
        r.market_price_coins != null ? Number(r.market_price_coins) : undefined,
      ),
    };
    const arr = out.get(Number(r.deck_id)) ?? [];
    arr.push(line);
    out.set(Number(r.deck_id), arr);
  }
  for (const arr of out.values()) {
    arr.sort((a, b) =>
      (RARITY_RANK[b.rarity] ?? 0) - (RARITY_RANK[a.rarity] ?? 0) || a.name.localeCompare(b.name));
  }
  return out;
}

function toPublicDeck(
  meta: { id: string; name: string; description: string; user_id: string; author_name: string; import_count: number; published_at: string | null },
  lines: DeckSpeciesLine[],
): PublicDeck {
  const families: string[] = [];
  for (const l of lines) {
    const g = shopGameOf(l.speciesId);
    const label = g ? g.name : "Khác";
    if (!families.includes(label)) families.push(label);
  }
  return {
    id: Number(meta.id),
    name: meta.name,
    description: meta.description ?? "",
    authorId: meta.user_id,
    authorName: meta.author_name || "Người chơi",
    importCount: meta.import_count ?? 0,
    publishedAt: meta.published_at,
    cardCount: lines.reduce((s, l) => s + l.count, 0),
    speciesCount: lines.length,
    totalValue: lines.reduce((s, l) => s + l.unitValue * l.count, 0),
    families,
    lines,
  };
}

export interface DeckSearchOpts {
  q?: string;
  family?: string;
  card?: string;
  sort?: string;
  limit?: number;
}

export async function searchPublicDecks(opts: DeckSearchOpts): Promise<PublicDeck[]> {
  const q = (opts.q ?? "").trim().slice(0, 60);
  const card = (opts.card ?? "").trim().slice(0, 60);
  const game = SHOP_GAMES.find((g) => g.prefix === opts.family);
  const familyLike = game ? game.like : "";
  const order = opts.sort === "used"
    ? "d.import_count DESC, d.published_at DESC"
    : "d.published_at DESC NULLS LAST, d.id DESC";
  try {
    const res = await db().query(
      `SELECT d.id::text AS id, d.name, d.description, d.user_id, d.author_name,
              d.import_count, d.published_at::text AS published_at
       FROM tcg_decks d
       WHERE d.is_public
         AND ($1 = '' OR d.name ILIKE '%' || $1 || '%' OR d.author_name ILIKE '%' || $1 || '%')
         AND ($2 = '' OR EXISTS (
           SELECT 1 FROM tcg_deck_cards dc JOIN tcg_instances i ON i.code = dc.instance_code
           WHERE dc.deck_id = d.id AND i.species_id LIKE $2))
         AND ($3 = '' OR EXISTS (
           SELECT 1 FROM tcg_deck_cards dc JOIN tcg_instances i ON i.code = dc.instance_code
           JOIN game_species s ON s.id = i.species_id
           WHERE dc.deck_id = d.id AND s.name ILIKE '%' || $3 || '%'))
       ORDER BY ${order}
       LIMIT $4`,
      [q, familyLike, card, Math.min(48, Math.max(1, opts.limit ?? 24))],
    );
    const rate = await getPriceCoinsPerUsd();
    const comp = await compositions(res.rows.map((r) => Number(r.id)), rate);
    return res.rows.map((r) => toPublicDeck(r, comp.get(Number(r.id)) ?? []));
  } catch {
    return [];
  }
}

export async function publicDeckDetail(deckId: number): Promise<PublicDeck | null> {
  try {
    const res = await db().query(
      `SELECT d.id::text AS id, d.name, d.description, d.user_id, d.author_name,
              d.import_count, d.published_at::text AS published_at
       FROM tcg_decks d WHERE d.id = $1 AND d.is_public`,
      [deckId],
    );
    if (!res.rows.length) return null;
    const rate = await getPriceCoinsPerUsd();
    const comp = await compositions([deckId], rate);
    return toPublicDeck(res.rows[0], comp.get(deckId) ?? []);
  } catch {
    return null;
  }
}

export interface TxResult { ok: boolean; error: string }

export async function publishDeckWeb(
  userId: string, username: string, deckId: number, description: string,
): Promise<TxResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const own = await client.query(
      `SELECT name FROM tcg_decks WHERE id = $1 AND user_id = $2 FOR UPDATE`, [deckId, userId]);
    if (!own.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy bộ bài đó." }; }
    const cards = await client.query<{ species_id: string }>(
      `SELECT i.species_id FROM tcg_deck_cards dc JOIN tcg_instances i ON i.code = dc.instance_code
       WHERE dc.deck_id = $1`, [deckId]);
    const errors = validateDeckWeb(cards.rows.map((r) => r.species_id));
    if (errors.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: `Bộ chưa hợp lệ để công khai: ${errors.join("; ")}` };
    }
    await client.query(
      `UPDATE tcg_decks SET is_public = true, published_at = now(),
              author_name = $2, description = $3 WHERE id = $1`,
      [deckId, username.slice(0, 40), description.trim().slice(0, 200)],
    );
    await client.query("COMMIT");
    return { ok: true, error: "" };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function unpublishDeckWeb(userId: string, deckId: number): Promise<TxResult> {
  try {
    const res = await db().query(
      `UPDATE tcg_decks SET is_public = false WHERE id = $1 AND user_id = $2`, [deckId, userId]);
    return res.rowCount
      ? { ok: true, error: "" }
      : { ok: false, error: "Không tìm thấy bộ bài đó." };
  } catch {
    return { ok: false, error: "Có lỗi, thử lại sau." };
  }
}

async function deckSlotLimit(userId: string): Promise<number> {
  let maxDecks = 5;
  try {
    const cfg = await getBotConfig<{ maxDecks?: number }>("tcg_config");
    if (cfg && typeof cfg.maxDecks === "number") {
      maxDecks = Math.min(20, Math.max(1, Math.floor(cfg.maxDecks)));
    }
  } catch { /* default 5 */ }
  let extra = 0;
  try {
    const m = await getUserMembership(userId);
    if (m && m.active) {
      const tiers = normalizeMembershipTiers(await getBotConfig("membership_tiers"));
      const perks = effectivePerksWeb(tiers, m.tier_id);
      if (perks) extra = perks.extraTeams;
    }
  } catch { /* no perks */ }
  return maxDecks + extra;
}

export async function adoptDeckWeb(
  userId: string, deckId: number,
): Promise<TxResult & { newDeckId?: number }> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const src = await client.query(
      `SELECT name, user_id FROM tcg_decks WHERE id = $1 AND is_public FOR UPDATE`, [deckId]);
    if (!src.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Bộ bài không còn công khai." }; }
    if (src.rows[0].user_id === userId) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Đây là bộ bài của bạn." };
    }
    const limit = await deckSlotLimit(userId);
    const mine = await client.query<{ n: number }>(
      `SELECT COUNT(*)::int AS n FROM tcg_decks WHERE user_id = $1`, [userId]);
    if ((mine.rows[0]?.n ?? 0) >= limit) {
      await client.query("ROLLBACK");
      return { ok: false, error: `Bạn đã đạt giới hạn ${limit} bộ bài.` };
    }
    const comp = await client.query<{ species_id: string; n: number }>(
      `SELECT i.species_id, COUNT(*)::int AS n FROM tcg_deck_cards dc
       JOIN tcg_instances i ON i.code = dc.instance_code
       WHERE dc.deck_id = $1 GROUP BY i.species_id`, [deckId]);
    if (!comp.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Bộ bài trống." }; }
    const picked: string[] = [];
    const missing: string[] = [];
    for (const line of comp.rows) {
      const own = await client.query<{ code: string; sp_name: string | null }>(
        `SELECT i.code, s.name AS sp_name FROM tcg_instances i
         LEFT JOIN game_species s ON s.id = i.species_id
         WHERE i.user_id = $1 AND i.species_id = $2
         ORDER BY i.level DESC, i.enhance DESC, i.created_at ASC LIMIT $3`,
        [userId, line.species_id, line.n]);
      if (own.rows.length < line.n) {
        let label = own.rows[0]?.sp_name ?? null;
        if (!label) {
          const nm = await client.query<{ name: string }>(
            `SELECT name FROM game_species WHERE id = $1`, [line.species_id]);
          label = nm.rows[0]?.name ?? line.species_id;
        }
        missing.push(`${label} ×${line.n - own.rows.length}`);
      }
      picked.push(...own.rows.map((r) => r.code));
    }
    if (missing.length) {
      await client.query("ROLLBACK");
      const shown = missing.slice(0, 8).join(", ") + (missing.length > 8 ? `, … (+${missing.length - 8})` : "");
      return { ok: false, error: `Bạn chưa có đủ thẻ để dùng bộ này. Thiếu: ${shown}. Mua thêm ở Shop rồi thử lại.` };
    }
    const newName = `${src.rows[0].name} (bản sao)`.slice(0, 60);
    const ins = await client.query<{ id: string }>(
      `INSERT INTO tcg_decks (user_id, name) VALUES ($1, $2) RETURNING id::text AS id`,
      [userId, newName]);
    const newDeckId = Number(ins.rows[0].id);
    for (const code of picked) {
      await client.query(
        `INSERT INTO tcg_deck_cards (deck_id, instance_code) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [newDeckId, code]);
    }
    await client.query(`UPDATE tcg_decks SET import_count = import_count + 1 WHERE id = $1`, [deckId]);
    await client.query("COMMIT");
    return { ok: true, error: "", newDeckId };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}
