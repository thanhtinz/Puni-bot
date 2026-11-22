/**
 * Web Digimon Card Game battle (spec 6.39i): the per-game engine
 * with the real rules (lib/digimon-battle.ts — shared Memory Gauge,
 * Security stack, Breeding Area, digivolution by printed level +
 * colour) fed by the cards' real stats (game_species.dig_*).
 * [Blocker] / [Rush] come from the printed card text. Rewards settle
 * with the usual atomic-claim pattern (own cooldown kind
 * 'digbattlecd', 20s bucket).
 */
import { db } from "./db";
import { adjustBalanceTx } from "./player";
import { userPerksWeb } from "./gacha";
import { bumpQuest } from "./quest-hooks";
import {
  simulateDigimonBattle,
  type DigCard, type DigEvent,
} from "./digimon-battle";

const MAX_LEVEL = 100;
export const DIG_COOLDOWN_MS = 20_000;
/** Setup moves 5 Security + 5 hand + 1 breeding out of the deck, so
 * a playable deck needs depth behind those 11. */
const MIN_DECK = 20;

export interface DigCardView {
  speciesId: string;
  name: string;
  spriteUrl: string;
  level: number;
  dp: number;
  cost: number;
}
export interface DigimonOutcome {
  ok: true;
  win: boolean;
  turns: number;
  security: [number, number];
  coins: number;
  xp: number;
  leveledUp: string[];
  deckA: DigCardView[];
  deckB: DigCardView[];
  eggA: DigCardView | null;
  eggB: DigCardView | null;
  events: DigEvent[];
}

interface Row {
  code?: string;
  level?: number;
  xp?: number;
  enhance?: number;
  species_id: string;
  sp_name: string;
  dig_dp: number | null;
  dig_cost: number | null;
  dig_level: number | null;
  dig_evo_cost: number | null;
  dig_evo_level: number | null;
  dig_evo_color: string | null;
  dig_color: string | null;
  description: string | null;
  sprite_url: string | null;
}

const keywords = (desc: string | null) => ({
  blocker: /\[Blocker\]/i.test(desc ?? ""),
  rush: /\[Rush\]/i.test(desc ?? ""),
});
const toCard = (r: Row): DigCard => ({
  speciesId: r.species_id,
  name: r.sp_name,
  spriteUrl: String(r.sprite_url ?? ""),
  level: Number(r.dig_level ?? 3),
  dp: Number(r.dig_dp ?? 0),
  cost: Number(r.dig_cost ?? 0),
  evoCost: r.dig_evo_cost != null ? Number(r.dig_evo_cost) : null,
  evoLevel: r.dig_evo_level != null ? Number(r.dig_evo_level) : null,
  evoColor: r.dig_evo_color,
  color: String(r.dig_color ?? ""),
  ...keywords(r.description),
  enhance: Number(r.enhance ?? 0),
});
const toView = (c: DigCard): DigCardView => ({
  speciesId: c.speciesId,
  name: c.name,
  spriteUrl: c.spriteUrl,
  level: c.level,
  dp: c.dp + c.enhance * 500,
  cost: c.cost,
});

const BATTLE_SQL = `
  SELECT i.code, i.level, i.xp, i.enhance, i.species_id,
         s.name AS sp_name, s.dig_dp, s.dig_cost, s.dig_level,
         s.dig_evo_cost, s.dig_evo_level, s.dig_evo_color, s.dig_color,
         s.description, s.sprite_url
  FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
  WHERE i.user_id = $1 AND s.dig_dp IS NOT NULL AND s.dig_level >= 3
  ORDER BY EXISTS (
    SELECT 1 FROM tcg_decks d JOIN tcg_deck_cards dc ON dc.deck_id = d.id
    WHERE d.user_id = i.user_id AND d.is_active AND dc.instance_code = i.code
  ) DESC, i.level DESC, i.enhance DESC, i.code
  LIMIT 30`;

export async function digimonDeckPreview(
  userId: string,
): Promise<{ ready: boolean; count: number; deck: DigCardView[] }> {
  const res = await db().query(BATTLE_SQL, [userId]);
  const rows = res.rows as unknown as Row[];
  return {
    ready: rows.length >= MIN_DECK,
    count: rows.length,
    deck: rows.map((r) => toView(toCard(r))),
  };
}

const NPC_SQL = `
  SELECT id AS species_id, name AS sp_name, dig_dp, dig_cost, dig_level,
         dig_evo_cost, dig_evo_level, dig_evo_color, dig_color,
         description, sprite_url
  FROM game_species WHERE dig_dp IS NOT NULL AND dig_level IS NOT NULL`;

/** The Breeding Area base: the player's own Digi-Egg instance when
 * they own one, otherwise a random egg species so the Breeding Area
 * always works in a friendly auto-battle. */
async function playerEgg(userId: string): Promise<DigCard | null> {
  const own = await db().query(
    `SELECT i.species_id, s.name AS sp_name, s.dig_dp, s.dig_cost, s.dig_level,
            s.dig_evo_cost, s.dig_evo_level, s.dig_evo_color, s.dig_color,
            s.description, s.sprite_url
     FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
     WHERE i.user_id = $1 AND s.dig_level = 2 ORDER BY i.code LIMIT 1`,
    [userId],
  );
  const row = (own.rows as unknown as Row[])[0] ?? (await randomEggRow());
  return row ? toCard(row) : null;
}
async function randomEggRow(): Promise<Row | undefined> {
  const res = await db().query(
    `SELECT id AS species_id, name AS sp_name, dig_dp, dig_cost, dig_level,
            dig_evo_cost, dig_evo_level, dig_evo_color, dig_color,
            description, sprite_url
     FROM game_species WHERE dig_level = 2 ORDER BY random() LIMIT 1`,
  );
  return (res.rows as unknown as Row[])[0];
}

export async function digimonBattleWeb(
  userId: string,
): Promise<DigimonOutcome | { ok: false; error: string }> {
  const res = await db().query(BATTLE_SQL, [userId]);
  const rows = res.rows as unknown as Row[];
  if (rows.length < MIN_DECK) {
    return {
      ok: false,
      error: `Cần ít nhất ${MIN_DECK} lá Digimon có DP thật — bạn đang có ${rows.length}. Mở thêm gói Digimon nhé.`,
    };
  }
  const deck = rows.map(toCard);
  const avgLevel = rows.reduce((s, r) => s + Number(r.level ?? 1), 0) / rows.length;

  // NPC deck: a mixed Lv.3-7 body; its egg comes from the egg pool.
  const bodyRes = await db().query(`${NPC_SQL} AND dig_level BETWEEN 3 AND 7 ORDER BY random() LIMIT 30`);
  const npcRows = bodyRes.rows as unknown as Row[];
  if (npcRows.length < MIN_DECK) {
    return { ok: false, error: "Chưa đủ dữ liệu Digimon để tạo đối thủ." };
  }
  const npcDeck = npcRows.map(toCard);
  const [eggA, npcEggRow] = await Promise.all([playerEgg(userId), randomEggRow()]);
  const eggB = npcEggRow ? toCard(npcEggRow) : null;

  const seed = `dig:${userId}:${Date.now()}`;
  const result = simulateDigimonBattle(deck, npcDeck, seed, eggA, eggB);
  const win = result.winner === "a";
  const perks = await userPerksWeb(userId).catch(() => null);
  const coins = Math.round(
    (win ? Math.round(120 + avgLevel * 15) : 25) * (1 + (perks?.battleBonusPercent ?? 0) / 100),
  );
  const xp = Math.round((win ? 30 : 12) * (1 + (perks?.xpBonusPercent ?? 0) / 100));

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const bucket = String(Math.floor(Date.now() / DIG_COOLDOWN_MS));
    const claim = await client.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'digbattlecd', $2)
       ON CONFLICT DO NOTHING RETURNING user_id`,
      [userId, bucket],
    );
    if (!claim.rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Đang hồi chiêu — đợi ít giây rồi đấu tiếp." };
    }
    const leveledUp: string[] = [];
    for (const r of rows) {
      let level = Number(r.level ?? 1);
      let totalXp = Number(r.xp ?? 0) + xp;
      while (totalXp >= 100 && level < MAX_LEVEL) {
        totalXp -= 100;
        level += 1;
      }
      if (level > Number(r.level ?? 1)) leveledUp.push(`${r.sp_name} → Lv.${level}`);
      await client.query(
        `UPDATE tcg_instances SET xp = $2, level = $3 WHERE code = $1`,
        [r.code, totalXp, level],
      );
    }
    await adjustBalanceTx(client, userId, coins, "tcg-digimon-battle", win ? "Thắng đấu Digimon (web)" : "Đấu Digimon (web)");
    await client.query("COMMIT");
    await bumpQuest(userId, "battle_play", 1);
    if (win) await bumpQuest(userId, "battle_win", 1);
    return {
      ok: true,
      win,
      turns: result.turns,
      security: [result.securityA, result.securityB],
      coins,
      xp,
      leveledUp,
      deckA: deck.map(toView),
      deckB: npcDeck.map(toView),
      eggA: eggA ? toView(eggA) : null,
      eggB: eggB ? toView(eggB) : null,
      events: result.events,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: "Có lỗi khi kết toán trận đấu, thử lại sau." };
  } finally {
    client.release();
  }
}
