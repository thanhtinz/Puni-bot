/**
 * Web card battle (spec 6.24): a faithful port of the bot's
 * cardBattle — same engine (simulateCardBattle), same team rule
 * (first 5 cards of the active deck), same enemy generation, same
 * rewards and member bonuses. Differences are presentational only:
 * the log uses text side labels instead of the Discord emoji
 * markers, and rewards + card XP + the 20-second cooldown land in
 * ONE transaction (the cooldown rides tcg_claims with a 20s bucket,
 * the same atomic-claim pattern as the daily free pack).
 */
import { db } from "./db";
import { adjustBalanceTx } from "./player";
import { userDecks } from "./tcg";
import { userPerksWeb } from "./gacha";
import { bumpQuest } from "./quest-hooks";
import { speciesEdition } from "./player-deck";

const MAX_LEVEL = 100;
const MAX_ROUNDS = 40;
export const BATTLE_COOLDOWN_MS = 20_000;

export interface BattleCardInput {
  code: string;
  name: string;
  speciesId: string;
  maxHp: number;
  atk: number;
  spriteUrl?: string;
  rarity?: string;
}

interface BattleCardState extends BattleCardInput {
  hp: number;
  actions: number;
}

export function battleStatsFor(
  baseHp: number, baseAtk: number, level: number, enhance: number,
): { maxHp: number; atk: number } {
  const lvlMult = 1 + Math.max(0, level - 1) * 0.05;
  return {
    maxHp: Math.round(baseHp * 6 * lvlMult + enhance * 25),
    atk: Math.round(baseAtk * lvlMult + enhance * 3),
  };
}

/** One strike, structured for the arena playback (spec 6.24 visual pass). */
export interface BattleEvent {
  round: number;
  side: "a" | "b";
  attCode: string;
  attName: string;
  targetCode: string;
  targetName: string;
  dmg: number;
  special: boolean;
  targetHp: number;
  targetMaxHp: number;
  ko: boolean;
}

/** Port of bot simulateCardBattle; sideLabel renders "Đội bạn"/"Địch". */
export function simulateCardBattleWeb(
  teamA: BattleCardInput[], teamB: BattleCardInput[], rng: () => number,
): { winner: "a" | "b"; rounds: number; log: string[]; events: BattleEvent[] } {
  const a: BattleCardState[] = teamA.map((c) => ({ ...c, hp: c.maxHp, actions: 0 }));
  const b: BattleCardState[] = teamB.map((c) => ({ ...c, hp: c.maxHp, actions: 0 }));
  const log: string[] = [];
  const events: BattleEvent[] = [];
  const living = (team: BattleCardState[]) => team.filter((c) => c.hp > 0);
  let rounds = 0;

  const strike = (att: BattleCardState, foes: BattleCardState[], side: string, sideKey: "a" | "b") => {
    const targets = living(foes);
    if (!targets.length) return;
    const target = targets[Math.floor(rng() * targets.length)];
    att.actions += 1;
    const special = att.actions % 3 === 0;
    const spread = 0.85 + rng() * 0.3;
    const dmg = Math.max(1, Math.round(att.atk * spread * (special ? 1.6 : 1)));
    target.hp = Math.max(0, target.hp - dmg);
    log.push(
      `${side} ${att.name} ${special ? "ra đòn mạnh vào" : "đánh"} ${target.name}: −${dmg} HP` +
        (target.hp <= 0 ? ` — ${target.name} gục!` : ` (còn ${target.hp}/${target.maxHp})`),
    );
    events.push({
      round: rounds, side: sideKey,
      attCode: att.code, attName: att.name,
      targetCode: target.code, targetName: target.name,
      dmg, special, targetHp: target.hp, targetMaxHp: target.maxHp,
      ko: target.hp <= 0,
    });
  };

  while (living(a).length && living(b).length && rounds < MAX_ROUNDS) {
    rounds += 1;
    for (const card of a) {
      if (card.hp > 0 && living(b).length) strike(card, b, "Bạn ·", "a");
    }
    for (const card of b) {
      if (card.hp > 0 && living(a).length) strike(card, a, "Địch ·", "b");
    }
  }

  let winner: "a" | "b";
  if (living(a).length && !living(b).length) winner = "a";
  else if (living(b).length && !living(a).length) winner = "b";
  else {
    const hpA = a.reduce((s, c) => s + c.hp, 0);
    const hpB = b.reduce((s, c) => s + c.hp, 0);
    winner = hpA >= hpB ? "a" : "b";
  }
  return { winner, rounds, log, events };
}

export interface BattleOutcome {
  ok: true;
  win: boolean;
  rounds: number;
  log: string[];
  events: BattleEvent[];
  coins: number;
  xp: number;
  team: BattleCardInput[];
  enemy: BattleCardInput[];
  leveledUp: string[];
}

/**
 * Last battle per user, kept in memory for the result screen only
 * (rewards themselves are committed in the DB transaction). Lost on
 * restart — the page then simply shows no result block.
 */
const lastBattles = new Map<string, BattleOutcome>();
export function rememberBattle(userId: string, outcome: BattleOutcome): void {
  lastBattles.set(userId, outcome);
  if (lastBattles.size > 200) {
    const oldest = lastBattles.keys().next().value;
    if (oldest) lastBattles.delete(oldest);
  }
}
export function lastBattle(userId: string): BattleOutcome | undefined {
  return lastBattles.get(userId);
}

/** Active deck's first-5 preview for the battle page. */
export async function battleTeamPreview(
  userId: string,
): Promise<{ deckName: string; cards: Array<{ code: string; speciesId: string; name: string; level: number; spriteUrl: string; rarity: string }> } | { error: string }> {
  const decks = await userDecks(userId);
  const active = decks.find((d) => d.isActive) ?? decks[0];
  if (!active) return { error: "Bạn chưa có bộ bài nào — tạo bộ bài ở trang Bộ Bài trước." };
  if (active.codes.length < 5) {
    return { error: `Bộ bài "${active.name}" mới có ${active.codes.length} thẻ — cần ít nhất 5 thẻ để đấu.` };
  }
  const codes = active.codes.slice(0, 5);
  const res = await db().query(
    `SELECT i.code, i.level, i.species_id, s.name AS sp_name, s.sprite_url, s.rarity AS sp_rarity
     FROM tcg_instances i LEFT JOIN game_species s ON s.id = i.species_id
     WHERE i.code = ANY($1) AND i.user_id = $2`,
    [codes, userId],
  );
  const byCode = new Map(
    (res.rows as unknown as Array<Record<string, unknown>>).map((r) => [String(r.code), r]),
  );
  const cards = codes
    .filter((c) => byCode.has(c))
    .map((c) => {
      const r = byCode.get(c)!;
      return {
        code: c, speciesId: String(r.species_id),
        name: String(r.sp_name ?? r.species_id), level: Number(r.level),
        spriteUrl: String(r.sprite_url ?? ""), rarity: String(r.sp_rarity ?? "Common"),
      };
    });
  if (cards.length < 5) return { error: "Bộ bài đang dùng thiếu thẻ hợp lệ — kiểm tra lại ở trang Bộ Bài." };
  return { deckName: active.name, cards };
}

export async function cardBattleWeb(
  userId: string,
): Promise<BattleOutcome | { ok: false; error: string }> {
  const decks = await userDecks(userId);
  const active = decks.find((d) => d.isActive) ?? decks[0];
  if (!active) {
    return { ok: false, error: "Bạn chưa có bộ bài nào — tạo bộ bài ở trang Bộ Bài trước." };
  }
  if (active.codes.length < 5) {
    return { ok: false, error: `Bộ bài "${active.name}" mới có ${active.codes.length} thẻ — cần ít nhất 5 thẻ để đấu.` };
  }
  const codes = active.codes.slice(0, 5);
  const instRes = await db().query(
    `SELECT i.code, i.level, i.xp, i.enhance, i.species_id,
            s.name AS sp_name, s.base_hp, s.base_atk, s.sprite_url, s.rarity AS sp_rarity
     FROM tcg_instances i LEFT JOIN game_species s ON s.id = i.species_id
     WHERE i.code = ANY($1) AND i.user_id = $2`,
    [codes, userId],
  );
  const byCode = new Map(
    (instRes.rows as unknown as Array<Record<string, unknown>>).map((r) => [String(r.code), r]),
  );
  const team: BattleCardInput[] = [];
  const teamRows: Array<Record<string, unknown>> = [];
  for (const code of codes) {
    const r = byCode.get(code);
    if (!r) continue;
    const stats = battleStatsFor(
      Number(r.base_hp ?? 50), Number(r.base_atk ?? 50),
      Number(r.level), Number(r.enhance),
    );
    team.push({
      code, name: String(r.sp_name ?? r.species_id), speciesId: String(r.species_id), ...stats,
      spriteUrl: String(r.sprite_url ?? ""), rarity: String(r.sp_rarity ?? "Common"),
    });
    teamRows.push(r);
  }
  if (team.length < 5) {
    return { ok: false, error: "Bộ bài đang dùng thiếu thẻ hợp lệ — kiểm tra lại ở trang Bộ Bài." };
  }
  const avgLevel = teamRows.reduce((s, r) => s + Number(r.level), 0) / teamRows.length;

  const catRes = await db().query(
    `SELECT id, name, base_hp, base_atk, sprite_url, rarity FROM game_species WHERE enabled`,
  );
  const fullCatalog = catRes.rows as unknown as Array<{ id: string; name: string; base_hp: number; base_atk: number; sprite_url: string | null; rarity: string }>;
  // Edition split (spec 6.38): the rival team only uses the player's edition.
  const myEdition = speciesEdition(team[0]!.speciesId);
  const catalog = fullCatalog.filter((s) => speciesEdition(s.id) === myEdition);
  if (!catalog.length) return { ok: false, error: "Chưa có dữ liệu loài để tạo đối thủ." };
  const rng = Math.random;
  const enemy: BattleCardInput[] = [];
  for (let i = 0; i < 5; i++) {
    const sp = catalog[Math.floor(rng() * catalog.length)];
    const lvl = Math.max(1, Math.round(avgLevel * (0.85 + rng() * 0.3)));
    enemy.push({
      code: `enemy-${i}`, name: sp.name, speciesId: sp.id,
      ...battleStatsFor(sp.base_hp ?? 50, sp.base_atk ?? 50, lvl, 0),
      spriteUrl: sp.sprite_url ?? "", rarity: sp.rarity ?? "Common",
    });
  }

  const result = simulateCardBattleWeb(team, enemy, rng);
  const win = result.winner === "a";
  const perks = await userPerksWeb(userId).catch(() => null);
  const coins = Math.round(
    (win ? Math.round(120 + avgLevel * 15) : 25) * (1 + (perks?.battleBonusPercent ?? 0) / 100),
  );
  const xp = Math.round((win ? 30 : 12) * (1 + (perks?.xpBonusPercent ?? 0) / 100));

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const bucket = String(Math.floor(Date.now() / BATTLE_COOLDOWN_MS));
    const claim = await client.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'battlecd', $2)
       ON CONFLICT DO NOTHING RETURNING user_id`,
      [userId, bucket],
    );
    if (!claim.rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Đang hồi chiêu — đợi ít giây rồi đấu tiếp." };
    }
    const leveledUp: string[] = [];
    for (const r of teamRows) {
      let level = Number(r.level);
      let totalXp = Number(r.xp) + xp;
      while (totalXp >= 100 && level < MAX_LEVEL) {
        totalXp -= 100;
        level += 1;
      }
      if (level > Number(r.level)) {
        leveledUp.push(`${String(r.sp_name ?? r.species_id)} → Lv.${level}`);
      }
      await client.query(
        `UPDATE tcg_instances SET xp = $2, level = $3 WHERE code = $1`,
        [String(r.code), totalXp, level],
      );
    }
    await adjustBalanceTx(client, userId, coins, "tcg-battle", win ? "Thắng battle thẻ (web)" : "Battle thẻ (web)");
    await client.query("COMMIT");
    await bumpQuest(userId, "battle_play", 1);
    if (win) await bumpQuest(userId, "battle_win", 1);
    return {
      ok: true, win, rounds: result.rounds, log: result.log.slice(-14),
      events: result.events,
      coins, xp, team, enemy, leveledUp,
    };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}
