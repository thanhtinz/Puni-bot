import { db } from "@/lib/db";
import { adjustBalanceTx, fmtCoins, snapMoney } from "@/lib/player";
import { userDecks } from "@/lib/tcg";
import { deckEdition, validateDeckWeb } from "@/lib/player-deck";
import {
  battleStatsFor, simulateCardBattleWeb, type BattleCardInput,
} from "@/lib/battle";

export { fmtCoins };

/** Tournament system (spec 6.32) — single-elimination brackets of 8
 *  or 16 players, separate from casual/ranked duels. The entry fee is
 *  charged at join and the active deck is snapshotted into the entry,
 *  so trading cards mid-tournament cannot change a running bracket.
 *  A match runs its deterministic battle (seed = match id, replayable)
 *  the moment BOTH players check in; a match still unplayed 10 minutes
 *  after both players are known settles lazily as a walkover. Prize
 *  pool = fees x (1 - rake), split by the tournament's percentages. */

export const TOURNAMENT_WINDOW_MS = 10 * 60 * 1000;
export const TOURNAMENT_SIZES = [8, 16] as const;

type TxResult = { ok: true } | { ok: false; error: string };
type TxClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, never>[]; rowCount?: number | null }>;
};

export interface TournamentConfig {
  entryFee: number;
  rakePercent: number;
  size: number;
  prizeFirst: number;
  prizeSecond: number;
  prizeSemis: number;
}

export async function getTournamentConfig(): Promise<TournamentConfig> {
  const dflt: TournamentConfig = {
    entryFee: 500, rakePercent: 10, size: 8,
    prizeFirst: 50, prizeSecond: 30, prizeSemis: 20,
  };
  try {
    const res = await db().query<{ value: Record<string, unknown> }>(
      `SELECT value FROM bot_config WHERE key = 'tcg_config'`,
    );
    const v = res.rows[0]?.value ?? {};
    const num = (k: string, fb: number, min: number, max: number) => {
      const n = v[k];
      return typeof n === "number" && Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fb;
    };
    return {
      entryFee: num("tournamentEntryFee", dflt.entryFee, 0, 1_000_000),
      rakePercent: num("tournamentRakePercent", dflt.rakePercent, 0, 90),
      size: TOURNAMENT_SIZES.includes(v.tournamentSize as 8 | 16)
        ? (v.tournamentSize as number) : dflt.size,
      prizeFirst: num("tournamentPrizeFirst", dflt.prizeFirst, 0, 100),
      prizeSecond: num("tournamentPrizeSecond", dflt.prizeSecond, 0, 100),
      prizeSemis: num("tournamentPrizeSemis", dflt.prizeSemis, 0, 100),
    };
  } catch {
    return dflt;
  }
}

/** Deterministic RNG (mulberry32) — same seed, same battle, forever. */
function rngFromSeed(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function totalRounds(size: number): number {
  return Math.round(Math.log2(size));
}

export function roundName(round: number, size: number): string {
  const total = totalRounds(size);
  if (round === total) return "Chung kết";
  if (round === total - 1) return "Bán kết";
  if (round === total - 2) return "Tứ kết";
  return `Vòng ${size / 2 ** (round - 1)}`;
}

export interface TournamentRow {
  id: number;
  name: string;
  size: number;
  entryFee: number;
  rakePercent: number;
  prizeFirst: number;
  prizeSecond: number;
  prizeSemis: number;
  status: string;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  championId: string | null;
  /** Edition lock (spec 6.38): set by the first entrant's deck. */
  edition: "en" | "jp" | null;
  entrants: number;
  joined: boolean;
}

export interface EntryRow { userId: string; seed: number | null }

export interface MatchRow {
  id: number;
  round: number;
  slot: number;
  p1Id: string | null;
  p2Id: string | null;
  p1In: boolean;
  p2In: boolean;
  readyAt: string | null;
  winnerId: string | null;
  result: string | null;
  log: string[] | null;
  playedAt: string | null;
}

const TOURNEY_SELECT = `
  SELECT t.id, t.name, t.size, t.entry_fee::text AS entry_fee,
         t.rake_percent::text AS rake_percent, t.prize_first::text AS prize_first,
         t.prize_second::text AS prize_second, t.prize_semis::text AS prize_semis,
         t.status, t.created_at::text AS created_at, t.started_at::text AS started_at,
         t.finished_at::text AS finished_at, t.champion_id, t.edition,
         (SELECT COUNT(*)::int FROM tcg_tournament_entries e WHERE e.tournament_id = t.id) AS entrants
  FROM tcg_tournaments t`;

function mapTournament(r: Record<string, unknown>, meId?: string): TournamentRow {
  return {
    id: Number(r.id), name: String(r.name), size: Number(r.size),
    entryFee: Number(r.entry_fee), rakePercent: Number(r.rake_percent),
    prizeFirst: Number(r.prize_first), prizeSecond: Number(r.prize_second),
    prizeSemis: Number(r.prize_semis), status: String(r.status),
    createdAt: String(r.created_at),
    startedAt: r.started_at ? String(r.started_at) : null,
    finishedAt: r.finished_at ? String(r.finished_at) : null,
    championId: r.champion_id ? String(r.champion_id) : null,
    edition: r.edition === "jp" ? "jp" : r.edition === "en" ? "en" : null,
    entrants: Number(r.entrants ?? 0),
    joined: meId ? r.joined === true : false,
  };
}

async function lockBracketTx(client: TxClient, t: { id: number; size: number }): Promise<void> {
  const res = await client.query(
    `SELECT user_id FROM tcg_tournament_entries WHERE tournament_id = $1 ORDER BY joined_at, user_id`,
    [t.id],
  );
  const ids = res.rows.map((r) => String(r.user_id));
  const rng = rngFromSeed(t.id * 7919 + 13);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j], ids[i]];
  }
  for (let i = 0; i < ids.length; i++) {
    await client.query(
      `UPDATE tcg_tournament_entries SET seed = $1 WHERE tournament_id = $2 AND user_id = $3`,
      [i + 1, t.id, ids[i]],
    );
  }
  const bySeed = new Map(ids.map((id, i) => [i + 1, id]));
  for (let slot = 0; slot < t.size / 2; slot++) {
    await client.query(
      `INSERT INTO tcg_tournament_matches (tournament_id, round, slot, p1_id, p2_id, ready_at)
       VALUES ($1, 1, $2, $3, $4, now())`,
      [t.id, slot, bySeed.get(slot + 1), bySeed.get(t.size - slot)],
    );
  }
  await client.query(
    `UPDATE tcg_tournaments SET status = 'running', started_at = now() WHERE id = $1`,
    [t.id],
  );
}

interface MatchDb {
  id: number; tournament_id: number; round: number; slot: number;
  p1_id: string | null; p2_id: string | null;
  p1_in: boolean; p2_in: boolean; winner_id: string | null;
}

/** Advance a decided match's winner; finish + pay out on the final. */
async function advanceTx(client: TxClient, m: MatchDb, winnerId: string): Promise<void> {
  const tRes = await client.query(
    `SELECT id, size, entry_fee::text AS entry_fee, rake_percent::text AS rake_percent,
            prize_first::text AS prize_first, prize_second::text AS prize_second,
            prize_semis::text AS prize_semis
     FROM tcg_tournaments WHERE id = $1 FOR UPDATE`,
    [m.tournament_id],
  );
  const t = tRes.rows[0] as unknown as {
    id: number; size: number; entry_fee: string; rake_percent: string;
    prize_first: string; prize_second: string; prize_semis: string;
  };
  const rounds = totalRounds(t.size);
  if (m.round < rounds) {
    const nextSlot = Math.floor(m.slot / 2);
    const col = m.slot % 2 === 0 ? "p1_id" : "p2_id";
    await client.query(
      `INSERT INTO tcg_tournament_matches (tournament_id, round, slot, ${col})
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tournament_id, round, slot) DO UPDATE SET ${col} = EXCLUDED.${col}`,
      [t.id, m.round + 1, nextSlot, winnerId],
    );
    await client.query(
      `UPDATE tcg_tournament_matches SET ready_at = now()
       WHERE tournament_id = $1 AND round = $2 AND slot = $3
         AND p1_id IS NOT NULL AND p2_id IS NOT NULL AND ready_at IS NULL`,
      [t.id, m.round + 1, nextSlot],
    );
    return;
  }
  // Final decided: pay the prize pool out in this same transaction.
  const pool = snapMoney(t.size * Number(t.entry_fee) * (1 - Number(t.rake_percent) / 100));
  const loserId = m.p1_id === winnerId ? m.p2_id : m.p1_id;
  const semiRes = await client.query(
    `SELECT p1_id, p2_id, winner_id FROM tcg_tournament_matches
     WHERE tournament_id = $1 AND round = $2 AND winner_id IS NOT NULL`,
    [t.id, rounds - 1],
  );
  const semiRows = semiRes.rows as unknown as Array<{
    p1_id: string | null; p2_id: string | null; winner_id: string | null;
  }>;
  const semiLosers = semiRows
    .map((r) => (r.p1_id === r.winner_id ? r.p2_id : r.p1_id))
    .filter((x): x is string => typeof x === "string");
  const pay = async (userId: string | null, amount: number, note: string) => {
    if (userId && amount > 0) {
      await adjustBalanceTx(client, userId, snapMoney(amount), "tournament", note);
    }
  };
  await pay(winnerId, (pool * Number(t.prize_first)) / 100, `Vô địch giải #${t.id}`);
  await pay(loserId, (pool * Number(t.prize_second)) / 100, `Á quân giải #${t.id}`);
  const semiEach = (pool * Number(t.prize_semis)) / 100 / Math.max(1, semiLosers.length);
  for (const u of semiLosers) await pay(u, semiEach, `Bán kết giải #${t.id}`);
  await client.query(
    `UPDATE tcg_tournaments SET status = 'done', champion_id = $1, finished_at = now() WHERE id = $2`,
    [winnerId, t.id],
  );
}

async function buildTeamTx(client: TxClient, codes: string[]): Promise<BattleCardInput[]> {
  const res = await client.query(
    `SELECT i.code, i.level, i.enhance, i.species_id,
            s.name AS sp_name, s.base_hp, s.base_atk
     FROM tcg_instances i LEFT JOIN game_species s ON s.id = i.species_id
     WHERE i.code = ANY($1)`,
    [codes.slice(0, 5)],
  );
  const byCode = new Map(
    res.rows.map((r) => [String(r.code), r] as const),
  );
  const team: BattleCardInput[] = [];
  for (const code of codes.slice(0, 5)) {
    const r = byCode.get(code);
    if (!r) continue;
    const stats = battleStatsFor(
      Number(r.base_hp ?? 50), Number(r.base_atk ?? 50),
      Number(r.level), Number(r.enhance),
    );
    team.push({
      code, name: String(r.sp_name ?? r.species_id),
      speciesId: String(r.species_id), ...stats,
    });
  }
  return team;
}

/** Run the deterministic battle for a match whose players both checked
 *  in, record the result and advance the winner. Caller holds the tx. */
async function runBattleTx(client: TxClient, m: MatchDb): Promise<void> {
  const entries = await client.query(
    `SELECT user_id, deck_codes FROM tcg_tournament_entries WHERE tournament_id = $1 AND user_id = ANY($2)`,
    [m.tournament_id, [m.p1_id, m.p2_id]],
  );
  const decks = new Map(entries.rows.map((r) => [String(r.user_id), r.deck_codes as string[]]));
  const teamA = await buildTeamTx(client, decks.get(m.p1_id ?? "") ?? []);
  const teamB = await buildTeamTx(client, decks.get(m.p2_id ?? "") ?? []);
  let winnerId: string;
  let result: string;
  let log: string[];
  if (teamA.length < 5 || teamB.length < 5) {
    winnerId = teamA.length >= 5 ? (m.p1_id as string) : (m.p2_id as string);
    result = "walkover";
    log = ["Một bên không còn đủ 5 thẻ hợp lệ trong bộ bài đã đăng ký — xử thắng cho đối thủ."];
  } else {
    const sim = simulateCardBattleWeb(teamA, teamB, rngFromSeed(m.id * 31 + 7));
    winnerId = sim.winner === "a" ? (m.p1_id as string) : (m.p2_id as string);
    result = "battle";
    log = sim.log.slice(0, 200);
  }
  await client.query(
    `UPDATE tcg_tournament_matches SET winner_id = $1, result = $2, log = $3::jsonb, played_at = now() WHERE id = $4`,
    [winnerId, result, JSON.stringify(log), m.id],
  );
  await advanceTx(client, m, winnerId);
}

/** Settle every match whose 10-minute window has closed. Best-effort
 *  per read, exactly like auction settlement. */
export async function settleTournamentTimeouts(): Promise<void> {
  try {
    const due = await db().query(
      `SELECT m.id FROM tcg_tournament_matches m
       JOIN tcg_tournaments t ON t.id = m.tournament_id
       WHERE t.status = 'running' AND m.winner_id IS NULL
         AND m.p1_id IS NOT NULL AND m.p2_id IS NOT NULL
         AND m.ready_at IS NOT NULL
         AND m.ready_at < now() - ($1 || ' milliseconds')::interval
       ORDER BY m.ready_at LIMIT 50`,
      [String(TOURNAMENT_WINDOW_MS)],
    );
    for (const row of due.rows as { id: number }[]) {
      const client = await db().connect();
      try {
        await client.query("BEGIN");
        const res = await client.query(
          `SELECT id, tournament_id, round, slot, p1_id, p2_id, p1_in, p2_in, winner_id,
                  ready_at < now() - ($2 || ' milliseconds')::interval AS expired
           FROM tcg_tournament_matches WHERE id = $1 FOR UPDATE`,
          [row.id, String(TOURNAMENT_WINDOW_MS)],
        );
        const m = res.rows[0] as unknown as (MatchDb & { expired: boolean }) | undefined;
        if (m && !m.winner_id && m.expired) {
          let winnerId: string;
          let result: string;
          if (m.p1_in !== m.p2_in) {
            winnerId = m.p1_in ? (m.p1_id as string) : (m.p2_id as string);
            result = "walkover";
          } else {
            const seeds = await client.query(
              `SELECT user_id, seed FROM tcg_tournament_entries
               WHERE tournament_id = $1 AND user_id = ANY($2)`,
              [m.tournament_id, [m.p1_id, m.p2_id]],
            );
            const seedOf = new Map(seeds.rows.map((r) => [String(r.user_id), Number(r.seed ?? 99)]));
            winnerId = (seedOf.get(m.p1_id ?? "") ?? 99) <= (seedOf.get(m.p2_id ?? "") ?? 99)
              ? (m.p1_id as string) : (m.p2_id as string);
            result = "double-walkover";
          }
          await client.query(
            `UPDATE tcg_tournament_matches SET winner_id = $1, result = $2,
                    log = $3::jsonb, played_at = now() WHERE id = $4`,
            [winnerId, result,
             JSON.stringify(["Quá 10 phút không đấu — xử thua theo luật walkover."]), m.id],
          );
          await advanceTx(client, m, winnerId);
        }
        await client.query("COMMIT");
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
      } finally {
        client.release();
      }
    }
  } catch {
    /* best-effort per read; the next read retries */
  }
}

export async function createTournament(
  ownerId: string,
  input: { name: string; size: number; entryFee: number; rakePercent: number; prizeFirst: number; prizeSecond: number; prizeSemis: number },
): Promise<TxResult> {
  const name = input.name.trim().slice(0, 80) || "Giải đấu Puni";
  if (!TOURNAMENT_SIZES.includes(input.size as 8 | 16)) {
    return { ok: false, error: "Số người của giải chỉ có thể là 8 hoặc 16." };
  }
  if (!Number.isFinite(input.entryFee) || input.entryFee < 0 || input.entryFee > 1_000_000) {
    return { ok: false, error: "Phí tham gia không hợp lệ." };
  }
  const splitSum = input.prizeFirst + input.prizeSecond + input.prizeSemis;
  if (!(splitSum > 0) || splitSum > 100) {
    return { ok: false, error: "Tổng tỉ lệ chia thưởng phải trong khoảng 1–100%." };
  }
  await db().query(
    `INSERT INTO tcg_tournaments (name, size, entry_fee, rake_percent, prize_first, prize_second, prize_semis, created_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
    [name, input.size, snapMoney(input.entryFee), input.rakePercent,
     input.prizeFirst, input.prizeSecond, input.prizeSemis, ownerId],
  );
  return { ok: true };
}

export async function joinTournament(userId: string, tournamentId: number): Promise<TxResult> {
  const decks = await userDecks(userId);
  const active = decks.find((d) => d.isActive) ?? decks[0];
  if (!active) return { ok: false, error: "Bạn chưa có bộ bài nào — tạo bộ bài ở trang Bộ Bài trước." };
  if (active.codes.length !== 30) {
    return { ok: false, error: `Bộ bài "${active.name}" có ${active.codes.length} thẻ — giải đấu cần bộ bài đúng 30 thẻ.` };
  }
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const tRes = await client.query(
      `SELECT id, size, entry_fee::text AS entry_fee, status, edition FROM tcg_tournaments WHERE id = $1 FOR UPDATE`,
      [tournamentId],
    );
    const t = tRes.rows[0] as unknown as { id: number; size: number; entry_fee: string; status: string; edition: string | null } | undefined;
    if (!t) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy giải đấu." }; }
    if (t.status !== "open") { await client.query("ROLLBACK"); return { ok: false, error: "Giải này đã khoá đăng ký." }; }
    const already = await client.query(
      `SELECT 1 FROM tcg_tournament_entries WHERE tournament_id = $1 AND user_id = $2`,
      [t.id, userId],
    );
    if (already.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Bạn đã đăng ký giải này rồi." }; }
    const countRes = await client.query(
      `SELECT COUNT(*)::int AS n FROM tcg_tournament_entries WHERE tournament_id = $1`,
      [t.id],
    );
    const count = Number(countRes.rows[0]?.n ?? 0);
    if (count >= t.size) { await client.query("ROLLBACK"); return { ok: false, error: "Giải đã đủ người." }; }
    const inst = await client.query(
      `SELECT species_id FROM tcg_instances WHERE code = ANY($1) AND user_id = $2`,
      [active.codes, userId],
    );
    if (inst.rows.length !== 30) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Bộ bài đang dùng có thẻ không còn trong kho của bạn — kiểm tra lại ở trang Bộ Bài." };
    }
    const speciesIds = inst.rows.map((r) => String(r.species_id));
    const errors = validateDeckWeb(speciesIds);
    if (errors.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: `Bộ bài chưa hợp lệ: ${errors.join("; ")}.` };
    }
    // Edition split (spec 6.38): the first entrant fixes the edition
    // (the row is FOR UPDATE, so this is race-free); others must match.
    const myEdition = deckEdition(speciesIds);
    if (t.edition && t.edition !== myEdition) {
      await client.query("ROLLBACK");
      return { ok: false, error: `Giải này dành cho bản ${t.edition === "jp" ? "Nhật" : "tiếng Anh"} — bộ bài của bạn là bản ${myEdition === "jp" ? "Nhật" : "tiếng Anh"}.` };
    }
    if (!t.edition) {
      await client.query(`UPDATE tcg_tournaments SET edition = $2 WHERE id = $1`, [t.id, myEdition]);
    }
    const fee = Number(t.entry_fee);
    if (fee > 0) {
      const paid = await adjustBalanceTx(client, userId, -fee, "tournament", `Phí tham gia giải #${t.id}`);
      if (!paid) { await client.query("ROLLBACK"); return { ok: false, error: "Số dư Coins không đủ trả phí tham gia." }; }
    }
    await client.query(
      `INSERT INTO tcg_tournament_entries (tournament_id, user_id, deck_codes) VALUES ($1, $2, $3)`,
      [t.id, userId, active.codes],
    );
    if (count + 1 === t.size) await lockBracketTx(client, t);
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Đăng ký thất bại, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function playMatch(userId: string, matchId: number): Promise<TxResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `SELECT m.id, m.tournament_id, m.round, m.slot, m.p1_id, m.p2_id, m.p1_in, m.p2_in, m.winner_id,
              m.ready_at < now() - ($2 || ' milliseconds')::interval AS expired
       FROM tcg_tournament_matches m WHERE m.id = $1 FOR UPDATE`,
      [matchId, String(TOURNAMENT_WINDOW_MS)],
    );
    const m = res.rows[0] as unknown as (MatchDb & { expired: boolean }) | undefined;
    if (!m) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy trận đấu." }; }
    if (m.winner_id) { await client.query("ROLLBACK"); return { ok: false, error: "Trận này đã có kết quả." }; }
    if (m.p1_id !== userId && m.p2_id !== userId) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Bạn không phải người chơi của trận này." };
    }
    const tRes = await client.query(
      `SELECT status FROM tcg_tournaments WHERE id = $1`, [m.tournament_id],
    );
    if (String(tRes.rows[0]?.status) !== "running") {
      await client.query("ROLLBACK");
      return { ok: false, error: "Giải đấu không còn đang chạy." };
    }
    if (m.expired) {
      await client.query("ROLLBACK");
      // Let the lazy settler decide it, then report.
      await settleTournamentTimeouts();
      return { ok: false, error: "Đã quá 10 phút — trận được xử theo luật walkover." };
    }
    const col = m.p1_id === userId ? "p1_in" : "p2_in";
    await client.query(`UPDATE tcg_tournament_matches SET ${col} = TRUE WHERE id = $1`, [m.id]);
    if (m.p1_id === userId) m.p1_in = true; else m.p2_in = true;
    if (m.p1_in && m.p2_in) {
      await runBattleTx(client, m);
      await client.query("COMMIT");
      return { ok: true };
    }
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Vào trận thất bại, thử lại sau." };
  } finally {
    client.release();
  }
}

/** Owner-only: cancel a tournament that has not started and refund
 *  every entry fee in full. */
export async function cancelTournament(tournamentId: number): Promise<TxResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const tRes = await client.query(
      `SELECT id, entry_fee::text AS entry_fee, status FROM tcg_tournaments WHERE id = $1 FOR UPDATE`,
      [tournamentId],
    );
    const t = tRes.rows[0] as unknown as { id: number; entry_fee: string; status: string } | undefined;
    if (!t) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy giải đấu." }; }
    if (t.status !== "open") { await client.query("ROLLBACK"); return { ok: false, error: "Chỉ huỷ được giải chưa bắt đầu." }; }
    const fee = Number(t.entry_fee);
    if (fee > 0) {
      const entries = await client.query(
        `SELECT user_id FROM tcg_tournament_entries WHERE tournament_id = $1`, [t.id],
      );
      for (const e of entries.rows) {
        await adjustBalanceTx(client, String(e.user_id), fee, "tournament", `Hoàn phí giải #${t.id} bị huỷ`);
      }
    }
    await client.query(`UPDATE tcg_tournaments SET status = 'cancelled' WHERE id = $1`, [t.id]);
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Huỷ giải thất bại, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function listOpenTournaments(meId: string): Promise<TournamentRow[]> {
  const res = await db().query(`${TOURNEY_SELECT} WHERE t.status = 'open' ORDER BY t.id DESC LIMIT 20`);
  const mine = await db().query(
    `SELECT tournament_id::int AS id FROM tcg_tournament_entries WHERE user_id = $1`,
    [meId],
  );
  const myIds = new Set(mine.rows.map((r) => Number(r.id)));
  return res.rows.map((r) => {
    const t = mapTournament(r as unknown as Record<string, unknown>, meId);
    t.joined = myIds.has(t.id);
    return t;
  });
}

export async function listRunningTournaments(): Promise<TournamentRow[]> {
  const res = await db().query(
    `${TOURNEY_SELECT} WHERE t.status = 'running' ORDER BY t.id DESC LIMIT 10`,
  );
  return res.rows.map((r) => mapTournament(r as unknown as Record<string, unknown>));
}

export async function listPastTournaments(): Promise<TournamentRow[]> {
  const res = await db().query(
    `${TOURNEY_SELECT} WHERE t.status = 'done' ORDER BY t.finished_at DESC NULLS LAST LIMIT 10`,
  );
  return res.rows.map((r) => mapTournament(r as unknown as Record<string, unknown>));
}

export async function getTournamentDetail(id: number): Promise<{
  tournament: TournamentRow;
  entries: EntryRow[];
  matches: MatchRow[];
} | null> {
  const tRes = await db().query(`${TOURNEY_SELECT} WHERE t.id = $1`, [id]);
  const t = tRes.rows[0];
  if (!t) return null;
  const eRes = await db().query(
    `SELECT user_id, seed FROM tcg_tournament_entries WHERE tournament_id = $1 ORDER BY seed NULLS LAST, joined_at`,
    [id],
  );
  const mRes = await db().query(
    `SELECT id, round, slot, p1_id, p2_id, p1_in, p2_in, ready_at::text AS ready_at,
            winner_id, result, log, played_at::text AS played_at
     FROM tcg_tournament_matches WHERE tournament_id = $1 ORDER BY round, slot`,
    [id],
  );
  return {
    tournament: mapTournament(t as unknown as Record<string, unknown>),
    entries: eRes.rows.map((r) => ({ userId: String(r.user_id), seed: r.seed == null ? null : Number(r.seed) })),
    matches: mRes.rows.map((r) => ({
      id: Number(r.id), round: Number(r.round), slot: Number(r.slot),
      p1Id: r.p1_id ? String(r.p1_id) : null,
      p2Id: r.p2_id ? String(r.p2_id) : null,
      p1In: r.p1_in === true, p2In: r.p2_in === true,
      readyAt: r.ready_at ? String(r.ready_at) : null,
      winnerId: r.winner_id ? String(r.winner_id) : null,
      result: r.result ? String(r.result) : null,
      log: Array.isArray(r.log) ? (r.log as string[]) : null,
      playedAt: r.played_at ? String(r.played_at) : null,
    })),
  };
}

export async function myPastTournamentIds(meId: string): Promise<number[]> {
  const res = await db().query(
    `SELECT e.tournament_id::int AS id FROM tcg_tournament_entries e
     JOIN tcg_tournaments t ON t.id = e.tournament_id
     WHERE e.user_id = $1 AND t.status = 'done' ORDER BY t.finished_at DESC NULLS LAST LIMIT 5`,
    [meId],
  );
  return res.rows.map((r) => Number(r.id));
}

export async function myRunningTournamentIds(meId: string): Promise<number[]> {
  const res = await db().query(
    `SELECT e.tournament_id::int AS id FROM tcg_tournament_entries e
     JOIN tcg_tournaments t ON t.id = e.tournament_id
     WHERE e.user_id = $1 AND t.status = 'running' ORDER BY t.id DESC`,
    [meId],
  );
  return res.rows.map((r) => Number(r.id));
}
