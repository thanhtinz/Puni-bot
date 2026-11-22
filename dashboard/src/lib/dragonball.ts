/**
 * Web Dragon Ball Fusion World battle (spec 6.39): the per-game
 * engine with the real Fusion World rules (lib/dragonball-battle.ts)
 * fed by the cards' real stats (game_species.db_*). The player's
 * Leader is their strongest owned Leader card (a generic
 * 15000/20000 warrior when they own none); their deck is their
 * Battle Card instances with real power. [Rush] / [Critical] come
 * from the printed card text. Rewards settle with the usual
 * atomic-claim pattern (own cooldown kind 'dbbattlecd', 20s bucket).
 */
import { db } from "./db";
import { adjustBalanceTx } from "./player";
import { userPerksWeb } from "./gacha";
import { bumpQuest } from "./quest-hooks";
import {
  simulateDragonBallBattle,
  type DbCard, type DbEvent,
} from "./dragonball-battle";

const MAX_LEVEL = 100;
export const DB_COOLDOWN_MS = 20_000;
/** Fusion World setup draws 8 Life + 6 hand cards before the first
 * draw, so a playable deck needs real depth behind those 14. */
const MIN_DECK = 20;

export interface DbCardView {
  speciesId: string;
  name: string;
  spriteUrl: string;
  cost: number;
  power: number;
  combo: number;
}
export interface DbLeaderView {
  name: string;
  spriteUrl: string;
  power: number;
  powerAwake: number;
}
export interface DragonBallOutcome {
  ok: true;
  win: boolean;
  turns: number;
  life: [number, number];
  coins: number;
  xp: number;
  leveledUp: string[];
  leaderA: DbLeaderView;
  leaderB: DbLeaderView;
  deckA: DbCardView[];
  deckB: DbCardView[];
  events: DbEvent[];
}

interface Row {
  code?: string;
  level?: number;
  xp?: number;
  enhance?: number;
  species_id: string;
  sp_name: string;
  db_cost: number | null;
  db_power: number | null;
  db_power_awake: number | null;
  db_combo: number | null;
  description: string | null;
  sprite_url: string | null;
}

const keywords = (desc: string | null) => ({
  rush: /\[Rush\]/i.test(desc ?? ""),
  critical: /\[Critical\]/i.test(desc ?? ""),
});
const toCard = (r: Row): DbCard => ({
  speciesId: r.species_id,
  name: r.sp_name,
  cost: Number(r.db_cost ?? 0),
  power: Number(r.db_power ?? 0),
  powerAwake: r.db_power_awake != null ? Number(r.db_power_awake) : undefined,
  combo: Number(r.db_combo ?? 0),
  kind: "Battle",
  ...keywords(r.description),
  enhance: Number(r.enhance ?? 0),
});
const toView = (c: DbCard, spriteUrl: string): DbCardView => ({
  speciesId: c.speciesId,
  name: c.name,
  spriteUrl,
  cost: c.cost,
  power: c.power + (c.enhance ?? 0) * 500,
  combo: c.combo,
});

const BATTLE_SQL = `
  SELECT i.code, i.level, i.xp, i.enhance, i.species_id,
         s.name AS sp_name, s.db_cost, s.db_power, s.db_power_awake,
         s.db_combo, s.description, s.sprite_url
  FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
  WHERE i.user_id = $1 AND s.db_kind = 'Battle' AND s.db_power IS NOT NULL
  ORDER BY EXISTS (
    SELECT 1 FROM tcg_decks d JOIN tcg_deck_cards dc ON dc.deck_id = d.id
    WHERE d.user_id = i.user_id AND d.is_active AND dc.instance_code = i.code
  ) DESC, i.level DESC, i.enhance DESC, i.code
  LIMIT 30`;

async function playerLeader(userId: string): Promise<{ leader: DbCard; view: DbLeaderView }> {
  const res = await db().query(
    `SELECT i.species_id, s.name AS sp_name, s.db_power, s.db_power_awake, s.sprite_url
     FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
     WHERE i.user_id = $1 AND s.db_kind = 'Leader' AND s.db_power IS NOT NULL
     ORDER BY s.db_power DESC, i.level DESC LIMIT 1`,
    [userId],
  );
  const r = res.rows[0] as unknown as Row | undefined;
  if (!r) {
    const generic: DbCard = {
      speciesId: "puni-warrior", name: "Chiến binh Puni",
      cost: 0, power: 15000, powerAwake: 20000, combo: 0, kind: "Leader",
    };
    return { leader: generic, view: { name: generic.name, spriteUrl: "", power: 15000, powerAwake: 20000 } };
  }
  const leader: DbCard = {
    speciesId: r.species_id,
    name: r.sp_name,
    cost: 0,
    power: Number(r.db_power),
    powerAwake: r.db_power_awake != null ? Number(r.db_power_awake) : undefined,
    combo: 0,
    kind: "Leader",
  };
  return {
    leader,
    view: {
      name: leader.name, spriteUrl: String(r.sprite_url ?? ""),
      power: leader.power, powerAwake: leader.powerAwake ?? leader.power,
    },
  };
}

export async function dragonballDeckPreview(
  userId: string,
): Promise<{ ready: boolean; count: number; leader: DbLeaderView; deck: DbCardView[] }> {
  const [res, lead] = await Promise.all([db().query(BATTLE_SQL, [userId]), playerLeader(userId)]);
  const rows = res.rows as unknown as Row[];
  return {
    ready: rows.length >= MIN_DECK,
    count: rows.length,
    leader: lead.view,
    deck: rows.map((r) => toView(toCard(r), String(r.sprite_url ?? ""))),
  };
}

export async function dragonballBattleWeb(
  userId: string,
): Promise<DragonBallOutcome | { ok: false; error: string }> {
  const res = await db().query(BATTLE_SQL, [userId]);
  const rows = res.rows as unknown as Row[];
  if (rows.length < MIN_DECK) {
    return {
      ok: false,
      error: `Cần ít nhất ${MIN_DECK} lá Battle Card Dragon Ball có Power thật — bạn đang có ${rows.length}. Mở thêm gói Dragon Ball Fusion World nhé.`,
    };
  }
  const deck = rows.map(toCard);
  const avgLevel = rows.reduce((s, r) => s + Number(r.level ?? 1), 0) / rows.length;
  const { leader, view: leaderView } = await playerLeader(userId);

  const npcLeaderRes = await db().query(
    `SELECT id, name, db_power, db_power_awake, sprite_url FROM game_species
     WHERE db_kind = 'Leader' AND db_power IS NOT NULL ORDER BY random() LIMIT 1`,
  );
  const nl = npcLeaderRes.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!nl) return { ok: false, error: "Chưa có dữ liệu Leader để tạo đối thủ." };
  const npcLeader: DbCard = {
    speciesId: String(nl.id), name: String(nl.name),
    cost: 0, power: Number(nl.db_power),
    powerAwake: nl.db_power_awake != null ? Number(nl.db_power_awake) : undefined,
    combo: 0, kind: "Leader",
  };
  const npcRes = await db().query(
    `SELECT id AS species_id, name AS sp_name, db_cost, db_power, db_power_awake,
            db_combo, description, sprite_url
     FROM game_species WHERE db_kind = 'Battle' AND db_power IS NOT NULL
     ORDER BY random() LIMIT 30`,
  );
  const npcRows = npcRes.rows as unknown as Row[];
  if (npcRows.length < MIN_DECK) {
    return { ok: false, error: "Chưa đủ dữ liệu Dragon Ball để tạo đối thủ." };
  }
  const npcDeck = npcRows.map(toCard);

  const seed = `db:${userId}:${Date.now()}`;
  const result = simulateDragonBallBattle(leader, deck, npcLeader, npcDeck, seed);
  const win = result.winner === "a";
  const perks = await userPerksWeb(userId).catch(() => null);
  const coins = Math.round(
    (win ? Math.round(120 + avgLevel * 15) : 25) * (1 + (perks?.battleBonusPercent ?? 0) / 100),
  );
  const xp = Math.round((win ? 30 : 12) * (1 + (perks?.xpBonusPercent ?? 0) / 100));

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const bucket = String(Math.floor(Date.now() / DB_COOLDOWN_MS));
    const claim = await client.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'dbbattlecd', $2)
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
    await adjustBalanceTx(client, userId, coins, "tcg-dragonball-battle", win ? "Thắng đấu Dragon Ball (web)" : "Đấu Dragon Ball (web)");
    await client.query("COMMIT");
    await bumpQuest(userId, "battle_play", 1);
    if (win) await bumpQuest(userId, "battle_win", 1);
    return {
      ok: true,
      win,
      turns: result.turns,
      life: result.life,
      coins,
      xp,
      leveledUp,
      leaderA: leaderView,
      leaderB: {
        name: npcLeader.name, spriteUrl: String(nl.sprite_url ?? ""),
        power: npcLeader.power, powerAwake: npcLeader.powerAwake ?? npcLeader.power,
      },
      deckA: deck.map((c, i) => toView(c, String(rows[i]!.sprite_url ?? ""))),
      deckB: npcDeck.map((c, i) => toView(c, String(npcRows[i]!.sprite_url ?? ""))),
      events: result.events,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => {});
    return { ok: false, error: "Có lỗi khi kết toán trận đấu, thử lại sau." };
  } finally {
    client.release();
  }
}
