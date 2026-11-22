/**
 * Web One Piece battle (spec 6.39): the per-game engine with the
 * real rules (lib/onepiece-battle.ts) fed by the cards' real stats
 * (game_species.op_*). The player's Leader is their strongest owned
 * Leader card (a generic 5000/5 captain when they own none); their
 * deck is their Character instances with real power. Keywords come
 * from the printed card text: [Blocker] / [Rush] / [Double Attack] /
 * [Banish]. Rewards settle with the usual atomic-claim pattern
 * (own cooldown kind 'opbattlecd', 20s bucket).
 */
import { db } from "./db";
import { adjustBalanceTx } from "./player";
import { userPerksWeb } from "./gacha";
import { bumpQuest } from "./quest-hooks";
import {
  simulateOnePieceBattle,
  type OpCard, type OpEvent, type OpLeader,
} from "./onepiece-battle";

const MAX_LEVEL = 100;
export const OP_COOLDOWN_MS = 20_000;
const MIN_DECK = 10;

export interface OpCardView {
  speciesId: string;
  name: string;
  spriteUrl: string;
  cost: number;
  power: number;
  counter: number;
}
export interface OpLeaderView {
  name: string;
  spriteUrl: string;
  power: number;
  life: number;
}
export interface OnePieceOutcome {
  ok: true;
  win: boolean;
  turns: number;
  life: [number, number];
  coins: number;
  xp: number;
  leveledUp: string[];
  leaderA: OpLeaderView;
  leaderB: OpLeaderView;
  deckA: OpCardView[];
  deckB: OpCardView[];
  events: OpEvent[];
}

interface Row {
  code?: string;
  level?: number;
  xp?: number;
  enhance?: number;
  species_id: string;
  sp_name: string;
  op_cost: number | null;
  op_power: number | null;
  op_counter: number | null;
  op_life: number | null;
  description: string | null;
  sprite_url: string | null;
}

const keywords = (desc: string | null) => ({
  blocker: /\[Blocker\]/i.test(desc ?? ""),
  rush: /\[Rush\]/i.test(desc ?? ""),
  doubleAttack: /\[Double Attack\]/i.test(desc ?? ""),
  banish: /\[Banish\]/i.test(desc ?? ""),
});
const toCard = (r: Row): OpCard => ({
  speciesId: r.species_id,
  name: r.sp_name,
  cost: Number(r.op_cost ?? 0),
  power: Number(r.op_power ?? 0),
  counter: Number(r.op_counter ?? 0),
  ...keywords(r.description),
  enhance: Number(r.enhance ?? 0),
});
const toView = (c: OpCard, spriteUrl: string): OpCardView => ({
  speciesId: c.speciesId,
  name: c.name,
  spriteUrl,
  cost: c.cost,
  power: c.power + (c.enhance ?? 0) * 200,
  counter: c.counter,
});

const CHAR_SQL = `
  SELECT i.code, i.level, i.xp, i.enhance, i.species_id,
         s.name AS sp_name, s.op_cost, s.op_power, s.op_counter,
         s.op_life, s.description, s.sprite_url
  FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
  WHERE i.user_id = $1 AND s.op_kind = 'Character' AND s.op_power IS NOT NULL
  ORDER BY EXISTS (
    SELECT 1 FROM tcg_decks d JOIN tcg_deck_cards dc ON dc.deck_id = d.id
    WHERE d.user_id = i.user_id AND d.is_active AND dc.instance_code = i.code
  ) DESC, i.level DESC, i.enhance DESC, i.code
  LIMIT 30`;

async function playerLeader(userId: string): Promise<{ leader: OpLeader; view: OpLeaderView }> {
  const res = await db().query(
    `SELECT i.species_id, s.name AS sp_name, s.op_power, s.op_life, s.sprite_url
     FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
     WHERE i.user_id = $1 AND s.op_kind = 'Leader' AND s.op_power IS NOT NULL
     ORDER BY s.op_power DESC, i.level DESC LIMIT 1`,
    [userId],
  );
  const r = res.rows[0] as unknown as Row | undefined;
  if (!r) {
    const generic: OpLeader = { speciesId: "puni-captain", name: "Thuyền trưởng Puni", power: 5000, life: 5 };
    return { leader: generic, view: { name: generic.name, spriteUrl: "", power: 5000, life: 5 } };
  }
  const leader: OpLeader = {
    speciesId: r.species_id,
    name: r.sp_name,
    power: Number(r.op_power),
    life: Number(r.op_life ?? 5),
  };
  return {
    leader,
    view: { name: leader.name, spriteUrl: String(r.sprite_url ?? ""), power: leader.power, life: leader.life },
  };
}

export async function onepieceDeckPreview(
  userId: string,
): Promise<{ ready: boolean; count: number; leader: OpLeaderView; deck: OpCardView[] }> {
  const [res, lead] = await Promise.all([db().query(CHAR_SQL, [userId]), playerLeader(userId)]);
  const rows = res.rows as unknown as Row[];
  return {
    ready: rows.length >= MIN_DECK,
    count: rows.length,
    leader: lead.view,
    deck: rows.map((r) => toView(toCard(r), String(r.sprite_url ?? ""))),
  };
}

export async function onepieceBattleWeb(
  userId: string,
): Promise<OnePieceOutcome | { ok: false; error: string }> {
  const res = await db().query(CHAR_SQL, [userId]);
  const rows = res.rows as unknown as Row[];
  if (rows.length < MIN_DECK) {
    return {
      ok: false,
      error: `Cần ít nhất ${MIN_DECK} lá Character One Piece có Power thật — bạn đang có ${rows.length}. Mở thêm gói One Piece nhé.`,
    };
  }
  const deck = rows.map(toCard);
  const avgLevel = rows.reduce((s, r) => s + Number(r.level ?? 1), 0) / rows.length;
  const { leader, view: leaderView } = await playerLeader(userId);

  const npcLeaderRes = await db().query(
    `SELECT id, name, op_power, op_life, sprite_url FROM game_species
     WHERE op_kind = 'Leader' AND op_power IS NOT NULL ORDER BY random() LIMIT 1`,
  );
  const nl = npcLeaderRes.rows[0] as unknown as Record<string, unknown> | undefined;
  if (!nl) return { ok: false, error: "Chưa có dữ liệu Leader để tạo đối thủ." };
  const npcLeader: OpLeader = {
    speciesId: String(nl.id), name: String(nl.name),
    power: Number(nl.op_power), life: Number(nl.op_life ?? 5),
  };
  const npcRes = await db().query(
    `SELECT id AS species_id, name AS sp_name, op_cost, op_power, op_counter,
            NULL AS op_life, description, sprite_url
     FROM game_species WHERE op_kind = 'Character' AND op_power IS NOT NULL
     ORDER BY random() LIMIT 30`,
  );
  const npcRows = npcRes.rows as unknown as Row[];
  if (npcRows.length < MIN_DECK) {
    return { ok: false, error: "Chưa đủ dữ liệu One Piece để tạo đối thủ." };
  }
  const npcDeck = npcRows.map(toCard);

  const seed = `op:${userId}:${Date.now()}`;
  const result = simulateOnePieceBattle(leader, deck, npcLeader, npcDeck, seed);
  const win = result.winner === "a";
  const perks = await userPerksWeb(userId).catch(() => null);
  const coins = Math.round(
    (win ? Math.round(120 + avgLevel * 15) : 25) * (1 + (perks?.battleBonusPercent ?? 0) / 100),
  );
  const xp = Math.round((win ? 30 : 12) * (1 + (perks?.xpBonusPercent ?? 0) / 100));

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const bucket = String(Math.floor(Date.now() / OP_COOLDOWN_MS));
    const claim = await client.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'opbattlecd', $2)
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
    await adjustBalanceTx(client, userId, coins, "tcg-onepiece-battle", win ? "Thắng đấu One Piece (web)" : "Đấu One Piece (web)");
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
        power: npcLeader.power, life: npcLeader.life,
      },
      deckA: deck.map((c, i) => toView(c, String(rows[i]!.sprite_url ?? ""))),
      deckB: npcDeck.map((c, i) => toView(c, String(npcRows[i]!.sprite_url ?? ""))),
      events: result.events,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}
