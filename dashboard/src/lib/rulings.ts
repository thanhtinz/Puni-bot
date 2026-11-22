/**
 * Rulings (spec 6.37) — official rulings. A ruling targets exactly one
 * scope: a species, a set, or a game family (prefix); exactly one of
 * species_id / set_id / game_prefix is set on any row. Card detail
 * pages show species rulings first, then set rulings, then family
 * rulings. Rows come from two origins: hand-entered in the Admin panel
 * (APITCG and TCGSDK carry no rulings data at all — verified
 * 2026-11-22), and Magic rulings synced from Scryfall bulk data by
 * scripts/sync-rulings-scryfall.py (reserved sources in SYNC_SOURCES).
 */
import { db } from "./db";
import { shopGameOf } from "./shop";
import { translateMany, translationConfigured, translationViewCap } from "./translate";

export interface Ruling {
  id: number;
  speciesId: string | null;
  setId: string | null;
  gamePrefix: string;
  scope: "species" | "set" | "game";
  title: string;
  body: string;
  /** Vietnamese translation of a synced (English) ruling, once made. */
  bodyVi: string;
  source: string;
  updatedAt: string;
}

interface RulingRow {
  id: string;
  species_id: string | null;
  set_id: string | null;
  game_prefix: string;
  title: string;
  body: string;
  body_vi: string | null;
  source: string;
  updated_at: string;
}

function toRuling(r: RulingRow): Ruling {
  return {
    id: Number(r.id),
    speciesId: r.species_id,
    setId: r.set_id,
    gamePrefix: r.game_prefix ?? "",
    scope: r.species_id ? "species" : r.set_id ? "set" : "game",
    title: r.title,
    body: r.body,
    bodyVi: r.body_vi ?? "",
    source: r.source ?? "",
    updatedAt: r.updated_at,
  };
}

const COLS = `id::text AS id, species_id, set_id, game_prefix, title, body, body_vi, source, updated_at::text AS updated_at`;

/** Rulings that apply to one card: its species, its set, its family. */
export async function rulingsForSpecies(speciesId: string, setId: string): Promise<Ruling[]> {
  const family = shopGameOf(speciesId)?.prefix ?? "";
  try {
    const res = await db().query<RulingRow>(
      `SELECT ${COLS} FROM tcg_rulings
       WHERE species_id = $1
          OR (species_id IS NULL AND set_id = $2)
          OR (species_id IS NULL AND set_id IS NULL AND game_prefix <> '' AND game_prefix = $3)
       ORDER BY CASE WHEN species_id = $1 THEN 0 WHEN set_id = $2 THEN 1 ELSE 2 END, id`,
      [speciesId, setId, family],
    );
    const rulings = res.rows.map(toRuling);
    await ensureRulingTranslations(rulings);
    return rulings;
  } catch {
    return [];
  }
}

/**
 * On-demand Vietnamese translation (owner order 2026-11-22): the first
 * time a card's rulings are viewed, translate the still-English synced
 * rulings and cache them in body_vi — later views are pure cache hits.
 * Only rows with a reserved sync source are eligible (they are the
 * English ones); hand-entered rulings are already Vietnamese. The
 * cache write is keyed by body text, so every printing that shares a
 * ruling text is filled by the same translation. Fails open: any
 * problem leaves the English original in place and a later view
 * retries.
 */
async function ensureRulingTranslations(rulings: Ruling[]): Promise<void> {
  if (!translationConfigured()) return;
  const pending = rulings.filter(
    (r) =>
      !r.bodyVi &&
      r.body.trim() !== "" &&
      (SYNC_SOURCES as readonly string[]).includes(r.source),
  );
  if (pending.length === 0) return;
  const uniqueTexts = [...new Set(pending.map((r) => r.body))].slice(0, translationViewCap());
  try {
    const translated = await translateMany(uniqueTexts);
    if (translated.size === 0) return;
    for (const [src, vi] of translated) {
      await db().query(
        `UPDATE tcg_rulings SET body_vi = $1
         WHERE body = $2 AND body_vi IS NULL AND source = ANY($3::text[])`,
        [vi, src, [...SYNC_SOURCES]],
      );
    }
    for (const r of rulings) {
      const vi = translated.get(r.body);
      if (vi) r.bodyVi = vi;
    }
  } catch {
    // Cache write failed — the page still renders, in English.
  }
}

/** Reserved source labels written by scripts/sync-rulings-scryfall.py.
 *  Hand-entered rulings must never use them — re-syncs replace those rows. */
export const SYNC_SOURCES = ["Scryfall · Wizards of the Coast", "Scryfall"] as const;

export type RulingOrigin = "all" | "manual" | "scryfall";

export async function listRulingsAdmin(origin: RulingOrigin = "all"): Promise<Ruling[]> {
  try {
    const where =
      origin === "scryfall"
        ? `WHERE source = ANY($1::text[])`
        : origin === "manual"
          ? `WHERE source IS NULL OR NOT (source = ANY($1::text[]))`
          : ``;
    const res = await db().query<RulingRow>(
      `SELECT ${COLS} FROM tcg_rulings ${where} ORDER BY updated_at DESC, id DESC LIMIT 300`,
      origin === "all" ? [] : [[...SYNC_SOURCES]],
    );
    return res.rows.map(toRuling);
  } catch {
    return [];
  }
}

export async function countRulings(origin: RulingOrigin): Promise<number> {
  try {
    const where =
      origin === "scryfall"
        ? `WHERE source = ANY($1::text[])`
        : origin === "manual"
          ? `WHERE source IS NULL OR NOT (source = ANY($1::text[]))`
          : ``;
    const res = await db().query<{ n: number }>(
      `SELECT count(*)::int AS n FROM tcg_rulings ${where}`,
      origin === "all" ? [] : [[...SYNC_SOURCES]],
    );
    return res.rows[0]?.n ?? 0;
  } catch {
    return 0;
  }
}

export interface RulingInput {
  speciesId: string | null;
  setId: string | null;
  gamePrefix: string;
  title: string;
  body: string;
  source: string;
}

export async function createRuling(input: RulingInput): Promise<void> {
  await db().query(
    `INSERT INTO tcg_rulings (species_id, set_id, game_prefix, title, body, source)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [input.speciesId, input.setId, input.gamePrefix, input.title, input.body, input.source],
  );
}

export async function updateRuling(id: number, input: RulingInput): Promise<void> {
  // Editing the body invalidates any cached translation of the old
  // text — clear body_vi when the text actually changes (a synced row
  // will simply be re-translated on its next view).
  await db().query(
    `UPDATE tcg_rulings SET species_id = $2, set_id = $3, game_prefix = $4,
            title = $5, body = $6, source = $7, updated_at = now(),
            body_vi = CASE WHEN body <> $6 THEN NULL ELSE body_vi END
     WHERE id = $1`,
    [id, input.speciesId, input.setId, input.gamePrefix, input.title, input.body, input.source],
  );
}

export async function deleteRuling(id: number): Promise<void> {
  await db().query(`DELETE FROM tcg_rulings WHERE id = $1`, [id]);
}

/** Target existence checks for the admin route (second layer of the
 * exact-scope rule; the route validates shape first). */
export async function speciesExists(id: string): Promise<boolean> {
  const res = await db().query(`SELECT 1 FROM game_species WHERE id = $1`, [id]);
  return res.rows.length > 0;
}

export async function setExists(id: string): Promise<boolean> {
  const res = await db().query(`SELECT 1 FROM game_sets WHERE id = $1`, [id]);
  return res.rows.length > 0;
}
