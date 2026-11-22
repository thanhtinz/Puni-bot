/**
 * Web Yu-Gi-Oh duel (spec 6.39): the per-game engine with the real
 * rules (lib/yugioh-battle.ts) fed by the cards' real stats from
 * YGOPRODeck (game_species.ygo_*). The player's deck list is their
 * own Yu-Gi-Oh instances with real stats (active-deck members
 * first, up to 30); the rival deck is sampled from the catalog.
 * Rewards settle with the same atomic-claim pattern as the other
 * arenas (own cooldown kind 'yugobattlecd', 20s bucket).
 */
import { db } from "./db";
import { adjustBalanceTx } from "./player";
import { userPerksWeb } from "./gacha";
import { bumpQuest } from "./quest-hooks";
import {
  simulateYugiohBattle,
  type YgoCard, type YgoEvent,
} from "./yugioh-battle";

const MAX_LEVEL = 100;
export const YGO_COOLDOWN_MS = 20_000;
const MIN_DECK = 10;

export interface YgoCardView {
  speciesId: string;
  name: string;
  spriteUrl: string;
  /** Monster-art-only image (YGOPRODeck cropped art) for the hologram. */
  artUrl: string;
  /** Link Monster (no DEF, no Level, always Attack Position). */
  link: boolean;
  atk: number;
  def: number;
  level: number;
  attribute: string;
}

export interface YugiohOutcome {
  ok: true;
  win: boolean;
  turns: number;
  lp: [number, number];
  coins: number;
  xp: number;
  leveledUp: string[];
  deckA: YgoCardView[];
  deckB: YgoCardView[];
  events: YgoEvent[];
}

interface InstRow {
  code: string;
  level: number;
  xp: number;
  enhance: number;
  species_id: string;
  sp_name: string;
  ygo_atk: number;
  ygo_def: number;
  ygo_level: number;
  ygo_attribute: string | null;
  ygo_race: string | null;
  ygo_card_type: string | null;
  sprite_url: string | null;
  ygo_art_url: string | null;
}

const INST_SQL = `
  SELECT i.code, i.level, i.xp, i.enhance, i.species_id,
         s.name AS sp_name, s.ygo_atk, s.ygo_def, s.ygo_level,
         s.ygo_attribute, s.ygo_race, s.ygo_card_type, s.sprite_url, s.ygo_art_url
  FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
  WHERE i.user_id = $1 AND s.ygo_atk IS NOT NULL
  ORDER BY EXISTS (
    SELECT 1 FROM tcg_decks d JOIN tcg_deck_cards dc ON dc.deck_id = d.id
    WHERE d.user_id = i.user_id AND d.is_active AND dc.instance_code = i.code
  ) DESC, i.level DESC, i.enhance DESC, i.code
  LIMIT 30`;

const toCard = (r: InstRow): YgoCard => ({
  speciesId: r.species_id,
  name: r.sp_name,
  atk: Number(r.ygo_atk),
  def: Number(r.ygo_def),
  level: Number(r.ygo_level),
  attribute: r.ygo_attribute ?? undefined,
  race: r.ygo_race ?? undefined,
  enhance: Number(r.enhance),
  link: (r.ygo_card_type ?? "").includes("Link"),
});
const toView = (c: YgoCard, spriteUrl: string, artUrl = ""): YgoCardView => ({
  speciesId: c.speciesId,
  name: c.name,
  spriteUrl,
  artUrl,
  link: !!c.link,
  atk: c.atk + (c.enhance ?? 0) * 50,
  def: c.def + (c.enhance ?? 0) * 50,
  level: c.level,
  attribute: c.attribute ?? "",
});

export async function yugiohDeckPreview(
  userId: string,
): Promise<{ ready: boolean; count: number; deck: YgoCardView[] }> {
  const res = await db().query(INST_SQL, [userId]);
  const rows = res.rows as unknown as InstRow[];
  return {
    ready: rows.length >= MIN_DECK,
    count: rows.length,
    deck: rows.map((r) => toView(toCard(r), String(r.sprite_url ?? ""), String(r.ygo_art_url ?? ""))),
  };
}

export async function yugiohBattleWeb(
  userId: string,
): Promise<YugiohOutcome | { ok: false; error: string }> {
  const res = await db().query(INST_SQL, [userId]);
  const rows = res.rows as unknown as InstRow[];
  if (rows.length < MIN_DECK) {
    return {
      ok: false,
      error: `Bộ bài Yu-Gi-Oh cần ít nhất ${MIN_DECK} lá có chỉ số thật — bạn đang có ${rows.length}. Mở thêm gói Yu-Gi-Oh nhé.`,
    };
  }
  const deck = rows.map(toCard);
  const avgLevel = rows.reduce((s, r) => s + Number(r.level), 0) / rows.length;

  const npcRes = await db().query(
    `SELECT id, name, ygo_atk, ygo_def, ygo_level, ygo_attribute, ygo_race, ygo_card_type, sprite_url, ygo_art_url
     FROM game_species WHERE ygo_atk IS NOT NULL
     ORDER BY random() LIMIT 30`,
  );
  const npcRows = npcRes.rows as unknown as Array<Record<string, unknown>>;
  if (npcRows.length < MIN_DECK) {
    return { ok: false, error: "Chưa đủ dữ liệu Yu-Gi-Oh để tạo đối thủ." };
  }
  const enemy: YgoCard[] = npcRows.map((r) => ({
    speciesId: String(r.id),
    name: String(r.name),
    atk: Number(r.ygo_atk),
    def: Number(r.ygo_def),
    level: Number(r.ygo_level),
    attribute: (r.ygo_attribute as string | null) ?? undefined,
    race: (r.ygo_race as string | null) ?? undefined,
    enhance: 0,
    link: String(r.ygo_card_type ?? "").includes("Link"),
  }));

  const seed = `ygo:${userId}:${Date.now()}`;
  const result = simulateYugiohBattle(deck, enemy, seed);
  const win = result.winner === "a";
  const perks = await userPerksWeb(userId).catch(() => null);
  const coins = Math.round(
    (win ? Math.round(120 + avgLevel * 15) : 25) * (1 + (perks?.battleBonusPercent ?? 0) / 100),
  );
  const xp = Math.round((win ? 30 : 12) * (1 + (perks?.xpBonusPercent ?? 0) / 100));

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const bucket = String(Math.floor(Date.now() / YGO_COOLDOWN_MS));
    const claim = await client.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'yugobattlecd', $2)
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
    await adjustBalanceTx(client, userId, coins, "tcg-yugioh-battle", win ? "Thắng đấu Yu-Gi-Oh (web)" : "Đấu Yu-Gi-Oh (web)");
    await client.query("COMMIT");
    await bumpQuest(userId, "battle_play", 1);
    if (win) await bumpQuest(userId, "battle_win", 1);
    return {
      ok: true,
      win,
      turns: result.turns,
      lp: result.lp,
      coins,
      xp,
      leveledUp,
      deckA: deck.map((c, i) => toView(c, String(rows[i]!.sprite_url ?? ""), String(rows[i]!.ygo_art_url ?? ""))),
      deckB: enemy.map((c, i) => toView(c, String(npcRows[i]!.sprite_url ?? ""), String(npcRows[i]!.ygo_art_url ?? ""))),
      events: result.events,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}
