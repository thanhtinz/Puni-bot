/**
 * Web Pokémon battle (spec 6.39): the per-game engine's first arena.
 * The player's team is their own Pokémon instances that carry real
 * moves (first 5, active-deck members first); the rival is an NPC
 * team from the same edition (EN or JP — editions never mix). Runs
 * the deterministic engine in lib/pokemon-battle.ts and settles
 * rewards with the same atomic-claim pattern as the generic battle
 * (own cooldown kind 'pokebattlecd', 20s bucket), plus card XP and
 * the daily-quest hooks.
 */
import { db } from "./db";
import { adjustBalanceTx } from "./player";
import { userPerksWeb } from "./gacha";
import { bumpQuest } from "./quest-hooks";
import { speciesEdition } from "./player-deck";
import {
  simulatePokemonBattle, pokeMaxHp,
  type PokeFighter, type PokeEvent,
} from "./pokemon-battle";

const MAX_LEVEL = 100;
export const POKE_COOLDOWN_MS = 20_000;

export interface PokeTeamCard {
  speciesId: string;
  name: string;
  spriteUrl: string;
  type: string;
  maxHp: number;
  moves: string[];
}

export interface PokemonOutcome {
  ok: true;
  win: boolean;
  prizes: [number, number];
  turns: number;
  coins: number;
  xp: number;
  leveledUp: string[];
  teamA: PokeTeamCard[];
  teamB: PokeTeamCard[];
  events: PokeEvent[];
}

interface InstRow {
  code: string;
  level: number;
  xp: number;
  enhance: number;
  species_id: string;
  sp_name: string;
  hp_real: number;
  poke_type: string;
  weakness: string | null;
  resistance: string | null;
  retreat: number | null;
  moves: PokeFighter["moves"];
  sprite_url: string | null;
  in_active_deck: boolean;
}

const INST_SQL = `
  SELECT i.code, i.level, i.xp, i.enhance, i.species_id,
         s.name AS sp_name, s.hp_real, s.poke_type, s.weakness,
         s.resistance, s.retreat, s.moves, s.sprite_url,
         EXISTS (
           SELECT 1 FROM tcg_decks d
           JOIN tcg_deck_cards dc ON dc.deck_id = d.id
           WHERE d.user_id = i.user_id AND d.is_active
             AND dc.instance_code = i.code
         ) AS in_active_deck
  FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
  WHERE i.user_id = $1 AND s.moves IS NOT NULL AND s.hp_real IS NOT NULL
    AND (s.id LIKE 'pkm-%' OR s.id LIKE 'pkmjp-%')
  ORDER BY in_active_deck DESC, i.level DESC, i.enhance DESC, i.code
  LIMIT 5`;

function toFighter(r: InstRow): PokeFighter {
  return {
    speciesId: r.species_id,
    name: r.sp_name,
    hp: Number(r.hp_real),
    type: String(r.poke_type ?? "C"),
    moves: r.moves ?? [],
    weakness: r.weakness,
    resistance: r.resistance,
    retreat: r.retreat ?? 0,
    level: Number(r.level),
    enhance: Number(r.enhance),
  };
}

function toCard(f: PokeFighter, spriteUrl: string): PokeTeamCard {
  return {
    speciesId: f.speciesId,
    name: f.name,
    spriteUrl,
    type: f.type,
    maxHp: pokeMaxHp(f),
    moves: f.moves.map((m) => m.name),
  };
}

export async function pokemonTeamPreview(
  userId: string,
): Promise<{ ready: boolean; team: PokeTeamCard[] }> {
  const res = await db().query(INST_SQL, [userId]);
  const rows = res.rows as unknown as InstRow[];
  return {
    ready: rows.length >= 5,
    team: rows.map((r) => toCard(toFighter(r), String(r.sprite_url ?? ""))),
  };
}

export async function pokemonBattleWeb(
  userId: string,
): Promise<PokemonOutcome | { ok: false; error: string }> {
  const res = await db().query(INST_SQL, [userId]);
  const rows = res.rows as unknown as InstRow[];
  if (rows.length < 5) {
    return {
      ok: false,
      error: `Bạn mới có ${rows.length}/5 lá Pokémon có chiêu thật — mở thêm gói Pokémon để đủ đội.`,
    };
  }
  const team = rows.map(toFighter);
  const edition = speciesEdition(team[0]!.speciesId);
  const avgLevel = rows.reduce((s, r) => s + Number(r.level), 0) / rows.length;

  const npcRes = await db().query(
    `SELECT id, name, hp_real, poke_type, weakness, resistance, retreat,
            moves, sprite_url
     FROM game_species
     WHERE moves IS NOT NULL AND hp_real BETWEEN 50 AND 260
       AND (id LIKE 'pkm-%' OR id LIKE 'pkmjp-%')
       AND CASE WHEN $1 = 'jp' THEN id LIKE 'pkmjp-%' ELSE id LIKE 'pkm-%' AND id NOT LIKE 'pkmjp-%' END
     ORDER BY random() LIMIT 5`,
    [edition],
  );
  const npcRows = npcRes.rows as unknown as Array<Record<string, unknown>>;
  if (npcRows.length < 5) {
    return { ok: false, error: "Chưa đủ dữ liệu Pokémon để tạo đối thủ." };
  }
  const enemy: PokeFighter[] = npcRows.map((r) => ({
    speciesId: String(r.id),
    name: String(r.name),
    hp: Number(r.hp_real),
    type: String(r.poke_type ?? "C"),
    moves: (r.moves as PokeFighter["moves"]) ?? [],
    weakness: (r.weakness as string | null) ?? null,
    resistance: (r.resistance as string | null) ?? null,
    retreat: Number(r.retreat ?? 0),
    level: Math.max(1, Math.round(avgLevel)),
    enhance: 0,
  }));

  const seed = `poke:${userId}:${Date.now()}`;
  const result = simulatePokemonBattle(team, enemy, seed);
  const win = result.winner === "a";
  const perks = await userPerksWeb(userId).catch(() => null);
  const coins = Math.round(
    (win ? Math.round(120 + avgLevel * 15) : 25) * (1 + (perks?.battleBonusPercent ?? 0) / 100),
  );
  const xp = Math.round((win ? 30 : 12) * (1 + (perks?.xpBonusPercent ?? 0) / 100));

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const bucket = String(Math.floor(Date.now() / POKE_COOLDOWN_MS));
    const claim = await client.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'pokebattlecd', $2)
       ON CONFLICT DO NOTHING RETURNING user_id`,
      [userId, bucket],
    );
    if (!claim.rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Đang hồi chiêu — đợi ít giây rồi đấu tiếp." };
    }
    const leveledUp: string[] = [];
    for (const r of rows) {
      let level = Number(r.level);
      let totalXp = Number(r.xp) + xp;
      while (totalXp >= 100 && level < MAX_LEVEL) {
        totalXp -= 100;
        level += 1;
      }
      if (level > Number(r.level)) leveledUp.push(`${r.sp_name} → Lv.${level}`);
      await client.query(
        `UPDATE tcg_instances SET xp = $2, level = $3 WHERE code = $1`,
        [r.code, totalXp, level],
      );
    }
    await adjustBalanceTx(client, userId, coins, "tcg-pokemon-battle", win ? "Thắng đấu Pokémon (web)" : "Đấu Pokémon (web)");
    await client.query("COMMIT");
    await bumpQuest(userId, "battle_play", 1);
    if (win) await bumpQuest(userId, "battle_win", 1);
    return {
      ok: true,
      win,
      prizes: result.prizes,
      turns: result.turns,
      coins,
      xp,
      leveledUp,
      teamA: team.map((f, i) => toCard(f, String(rows[i]!.sprite_url ?? ""))),
      teamB: enemy.map((f, i) => toCard(f, String(npcRows[i]!.sprite_url ?? ""))),
      events: result.events,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}
