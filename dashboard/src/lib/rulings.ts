/**
 * Rulings (spec 6.37) — owner-curated official rulings. A ruling
 * targets exactly one scope: a species, a set, or a game family
 * (prefix). Card detail pages show species rulings first, then set
 * rulings, then family rulings. No ruling is ever auto-generated:
 * TCGSDK exposes no rulings data (verified 2026-11-22), so every row
 * here was typed in the Admin panel from an official source.
 */
import { db } from "./db";
import { shopGameOf } from "./shop";

export interface Ruling {
  id: number;
  speciesId: string | null;
  setId: string | null;
  gamePrefix: string;
  scope: "species" | "set" | "game";
  title: string;
  body: string;
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
    source: r.source ?? "",
    updatedAt: r.updated_at,
  };
}

const COLS = `id::text AS id, species_id, set_id, game_prefix, title, body, source, updated_at::text AS updated_at`;

/** Rulings that apply to one card: its species, its set, its family. */
export async function rulingsForSpecies(speciesId: string, setId: string): Promise<Ruling[]> {
  const family = shopGameOf(speciesId)?.prefix ?? "";
  try {
    const res = await db().query<RulingRow>(
      `SELECT ${COLS} FROM tcg_rulings
       WHERE species_id = $1 OR set_id = $2 OR (game_prefix <> '' AND game_prefix = $3)
       ORDER BY CASE WHEN species_id = $1 THEN 0 WHEN set_id = $2 THEN 1 ELSE 2 END, id`,
      [speciesId, setId, family],
    );
    return res.rows.map(toRuling);
  } catch {
    return [];
  }
}

export async function listRulingsAdmin(): Promise<Ruling[]> {
  try {
    const res = await db().query<RulingRow>(
      `SELECT ${COLS} FROM tcg_rulings ORDER BY updated_at DESC, id DESC LIMIT 300`,
    );
    return res.rows.map(toRuling);
  } catch {
    return [];
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
  await db().query(
    `UPDATE tcg_rulings SET species_id = $2, set_id = $3, game_prefix = $4,
            title = $5, body = $6, source = $7, updated_at = now()
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
