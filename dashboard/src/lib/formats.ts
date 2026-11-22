/**
 * Web TCG battle formats (spec 6.38): Daily Challenge, Draft Arena,
 * Sealed. A faithful mirror of the bot's services/tcg-formats.ts —
 * the tcg_format_runs state JSON is the contract between surfaces,
 * the deterministic helpers below are verbatim copies, and rewards
 * ride the same tcg_claims rows, so a run or a daily reward moves
 * with the player between Discord and the web. Money moves only
 * inside transactions via adjustBalanceTx; a debit that fails
 * starts nothing.
 */
import { db } from "./db";
import { adjustBalanceTx } from "./player";
import { bumpQuest } from "./quest-hooks";
import { userDecks } from "./tcg";
import { speciesEdition, type CardEdition } from "./player-deck";
import { TCG_RARITIES, getTcgConfigWeb, type TcgRarity } from "./gacha";
import {
  battleStatsFor,
  simulateCardBattleWeb,
  type BattleCardInput,
  type BattleOutcome,
} from "./battle";

export type FormatKind = "draft" | "sealed";

export interface FormatRunState {
  phase: "draft" | "fight" | "done";
  round: number;
  offers: string[];
  roster: string[];
  pool: string[];
  field: string[];
  wins: number;
  losses: number;
  matchIndex: number;
}

export interface FormatRun {
  id: number;
  userId: string;
  format: FormatKind;
  state: FormatRunState;
  status: "building" | "fighting" | "done";
  paid: boolean;
  expiresAt: Date;
}

export const ENTRY_FEE_COINS = 300;
export const DRAFT_ROUNDS = 8;
export const SEALED_POOL = 30;
export const CHAIN_WINS = 3;
export const CHAIN_LOSSES = 2;
export const WIN_COINS = [150, 220, 320];
export const FINAL_WIN_SHARDS = 10;
export const CHALLENGE_COINS = 200;
export const CHALLENGE_SHARDS = 5;

export const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

/* ---- deterministic helpers: verbatim mirrors of the bot file ---- */

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFromSeed(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface CatalogRow {
  id: string;
  name: string;
  rarity: string;
  baseHp: number;
  baseAtk: number;
  spriteUrl: string;
}

export const cardPower = (maxHp: number, atk: number): number => maxHp + atk * 10;

export function speciesPower(sp: CatalogRow): number {
  const s = battleStatsFor(sp.baseHp || 50, sp.baseAtk || 50, 1, 0);
  return cardPower(s.maxHp, s.atk);
}

function phantomCard(sp: CatalogRow, code: string): BattleCardInput {
  const s = battleStatsFor(sp.baseHp || 50, sp.baseAtk || 50, 1, 0);
  return {
    code, name: sp.name, speciesId: sp.id, ...s,
    spriteUrl: sp.spriteUrl, rarity: sp.rarity,
  };
}

export function buildNpcTeam(
  catalog: CatalogRow[],
  rng: () => number,
  targetTotal: number,
): BattleCardInput[] {
  const usable = catalog
    .filter((s) => s.baseHp > 0 && s.baseAtk > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (usable.length === 0) return [];
  const deck = [...usable];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const per = targetTotal / 5;
  const picked: CatalogRow[] = [];
  for (const sp of deck) {
    if (picked.length >= 5) break;
    const p = speciesPower(sp);
    if (p >= per * 0.35 && p <= per * 2.4) picked.push(sp);
  }
  for (const sp of deck) {
    if (picked.length >= 5) break;
    if (!picked.includes(sp)) picked.push(sp);
  }
  const team = picked.map((sp, i) => phantomCard(sp, `NPC-${i + 1}`));
  const total = team.reduce((s, c) => s + cardPower(c.maxHp, c.atk), 0);
  const factor = Math.min(3, Math.max(0.4, targetTotal / Math.max(1, total)));
  return team.map((c) => ({
    ...c,
    maxHp: Math.max(1, Math.round(c.maxHp * factor)),
    atk: Math.max(1, Math.round(c.atk * factor)),
  }));
}

export function dailyOpponent(
  catalog: CatalogRow[],
  day: string,
  userId: string,
  playerTotalPower: number,
): BattleCardInput[] {
  const rng = rngFromSeed(hashSeed(`dailychal:${day}:${userId}`));
  return buildNpcTeam(catalog, rng, playerTotalPower * 1.05);
}

/* ------------------------- data access --------------------------- */

type TxClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, never>[]; rowCount?: number | null }>;
};

async function loadCatalog(): Promise<CatalogRow[]> {
  const res = await db().query(
    `SELECT id, name, rarity, base_hp, base_atk, sprite_url
     FROM game_species WHERE enabled ORDER BY id`,
  );
  return (res.rows as unknown as Array<Record<string, unknown>>).map((r) => ({
    id: String(r.id),
    name: String(r.name),
    rarity: String(r.rarity ?? "Common"),
    baseHp: Number(r.base_hp ?? 0),
    baseAtk: Number(r.base_atk ?? 0),
    spriteUrl: String(r.sprite_url ?? ""),
  }));
}

function mapRun(r: Record<string, unknown>): FormatRun {
  const state = (typeof r.state === "string" ? JSON.parse(r.state) : r.state) as FormatRunState;
  return {
    id: Number(r.id),
    userId: String(r.user_id),
    format: r.format as FormatKind,
    state,
    status: r.status as FormatRun["status"],
    paid: Boolean(r.paid),
    expiresAt: new Date(String(r.expires_at)),
  };
}

const RUN_COLS = "id, user_id, format, state, status, paid, expires_at";

async function activeRun(userId: string, format: FormatKind): Promise<FormatRun | null> {
  const res = await db().query(
    `SELECT ${RUN_COLS} FROM tcg_format_runs
     WHERE user_id = $1 AND format = $2 AND status <> 'done'
     ORDER BY id DESC LIMIT 1`,
    [userId, format],
  );
  const row = (res.rows as unknown as Array<Record<string, unknown>>)[0];
  if (!row) return null;
  const run = mapRun(row);
  if (run.expiresAt <= new Date()) {
    run.state.phase = "done";
    run.status = "done";
    await db().query(
      `UPDATE tcg_format_runs SET state = $2::jsonb, status = 'done', updated_at = now() WHERE id = $1`,
      [run.id, JSON.stringify(run.state)],
    );
    return null;
  }
  return run;
}

async function saveRun(run: FormatRun): Promise<void> {
  await db().query(
    `UPDATE tcg_format_runs SET state = $2::jsonb, status = $3, updated_at = now() WHERE id = $1`,
    [run.id, JSON.stringify(run.state), run.status],
  );
}

async function hasClaimed(userId: string, kind: string, period: string): Promise<boolean> {
  const res = await db().query(
    `SELECT 1 FROM tcg_claims WHERE user_id = $1 AND kind = $2 AND period = $3`,
    [userId, kind, period],
  );
  return (res.rowCount ?? 0) > 0;
}

async function addShardsTx(client: TxClient, userId: string, shards: number): Promise<void> {
  await client.query(
    `INSERT INTO tcg_wallets (user_id, shards) VALUES ($1, $2)
     ON CONFLICT (user_id) DO UPDATE SET shards = tcg_wallets.shards + $2`,
    [userId, shards],
  );
}

/* ------------------------- rarity rolls -------------------------- */

function rollSpeciesId(
  rng: () => number,
  rates: Record<TcgRarity, number>,
  catalog: CatalogRow[],
): CatalogRow | null {
  const total = TCG_RARITIES.reduce((s, r) => s + (rates[r] ?? 0), 0);
  let x = rng() * total;
  let rarity: TcgRarity = "Common";
  for (const r of TCG_RARITIES) {
    x -= rates[r] ?? 0;
    if (x <= 0) { rarity = r; break; }
  }
  const ofRarity = catalog.filter((s) => s.rarity === rarity);
  const pool = ofRarity.length ? ofRarity : catalog;
  if (!pool.length) return null;
  return pool[Math.floor(rng() * pool.length)]!;
}

function topField(ids: string[], byId: Map<string, CatalogRow>): string[] {
  return [...ids]
    .sort((a, b) => speciesPower(byId.get(b)!) - speciesPower(byId.get(a)!))
    .slice(0, 5);
}

/* ------------------------- Daily Challenge ----------------------- */

export type ChallengeOutcome = BattleOutcome & { rewardClaimed: boolean };

export async function dailyChallengeWeb(
  userId: string,
): Promise<ChallengeOutcome | { ok: false; error: string }> {
  const decks = await userDecks(userId);
  const active = decks.find((d) => d.isActive) ?? decks[0];
  if (!active) return { ok: false, error: "Bạn chưa có bộ bài nào — tạo bộ bài ở trang Bộ Bài trước." };
  if (active.codes.length < 5) {
    return { ok: false, error: `Bộ bài "${active.name}" mới có ${active.codes.length} thẻ — cần ít nhất 5 thẻ để đấu.` };
  }
  const codes = active.codes.slice(0, 5);
  const instRes = await db().query(
    `SELECT i.code, i.level, i.enhance, i.species_id,
            s.name AS sp_name, s.base_hp, s.base_atk, s.sprite_url, s.rarity AS sp_rarity
     FROM tcg_instances i LEFT JOIN game_species s ON s.id = i.species_id
     WHERE i.code = ANY($1) AND i.user_id = $2`,
    [codes, userId],
  );
  const byCode = new Map(
    (instRes.rows as unknown as Array<Record<string, unknown>>).map((r) => [String(r.code), r]),
  );
  const team: BattleCardInput[] = [];
  for (const code of codes) {
    const r = byCode.get(code);
    if (!r) continue;
    team.push({
      code, name: String(r.sp_name ?? r.species_id), speciesId: String(r.species_id),
      ...battleStatsFor(Number(r.base_hp ?? 50), Number(r.base_atk ?? 50), Number(r.level), Number(r.enhance)),
      spriteUrl: String(r.sprite_url ?? ""), rarity: String(r.sp_rarity ?? "Common"),
    });
  }
  if (team.length < 5) return { ok: false, error: "Bộ bài đang dùng thiếu thẻ hợp lệ — kiểm tra lại ở trang Bộ Bài." };

  const catalog = await loadCatalog();
  const day = utcDay(new Date());
  const totalPower = team.reduce((s, c) => s + cardPower(c.maxHp, c.atk), 0);
  // Edition split (spec 6.38): the daily rival uses the player's edition.
  const edition = speciesEdition(team[0]!.speciesId);
  const enemy = dailyOpponent(catalog.filter((s) => speciesEdition(s.id) === edition), day, userId, totalPower);
  if (enemy.length < 5) return { ok: false, error: "Kho thẻ chưa sẵn sàng cho thử thách ngày." };
  const rng = rngFromSeed(hashSeed(`dailychal-battle:${day}:${userId}`));
  const result = simulateCardBattleWeb(team, enemy, rng);
  const win = result.winner === "a";
  await bumpQuest(userId, "battle_play", 1);
  if (win) {
    await bumpQuest(userId, "battle_win", 1);
    await bumpQuest(userId, "challenge_win", 1);
  }

  let coins = 0;
  let rewardClaimed = false;
  if (win) {
    const client = await db().connect();
    try {
      await client.query("BEGIN");
      const claim = await client.query(
        `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'dailychal', $2)
         ON CONFLICT DO NOTHING RETURNING user_id`,
        [userId, day],
      );
      if (claim.rows.length) {
        rewardClaimed = true;
        coins = CHALLENGE_COINS;
        await adjustBalanceTx(client as TxClient, userId, coins, "tcg-challenge", "Thắng thử thách ngày (web)");
        await addShardsTx(client as TxClient, userId, CHALLENGE_SHARDS);
      }
      await client.query("COMMIT");
    } catch {
      await client.query("ROLLBACK").catch(() => undefined);
      return { ok: false, error: "Có lỗi khi trả thưởng, thử lại sau." };
    } finally {
      client.release();
    }
  }
  return {
    ok: true, win, rounds: result.rounds, log: result.log.slice(-14),
    events: result.events, coins, xp: 0, team, enemy, leveledUp: [], rewardClaimed,
  };
}

/* ------------------------- Draft / Sealed ------------------------ */

export interface SpeciesView {
  id: string;
  name: string;
  rarity: string;
  spriteUrl: string;
  power: number;
}

export interface FormatView {
  format: FormatKind;
  run: {
    id: number;
    phase: FormatRunState["phase"];
    round: number;
    wins: number;
    losses: number;
    offers: SpeciesView[];
    roster: SpeciesView[];
    poolTop: SpeciesView[];
    poolCount: number;
    field: SpeciesView[];
    paid: boolean;
  } | null;
  freeAvailable: boolean;
  entryFee: number;
  challengeRewardTaken: boolean;
}

function speciesView(sp: CatalogRow): SpeciesView {
  return { id: sp.id, name: sp.name, rarity: sp.rarity, spriteUrl: sp.spriteUrl, power: speciesPower(sp) };
}

export async function formatView(userId: string, format: FormatKind): Promise<FormatView> {
  const day = utcDay(new Date());
  const [run, freeUsed, chalTaken, catalog] = await Promise.all([
    activeRun(userId, format),
    hasClaimed(userId, `formatfree:${format}`, day),
    hasClaimed(userId, "dailychal", day),
    loadCatalog(),
  ]);
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const view = (id: string): SpeciesView => {
    const sp = byId.get(id);
    return sp ? speciesView(sp) : { id, name: id, rarity: "Common", spriteUrl: "", power: 0 };
  };
  return {
    format,
    run: run
      ? {
          id: run.id,
          phase: run.state.phase,
          round: run.state.round,
          wins: run.state.wins,
          losses: run.state.losses,
          offers: run.state.offers.map(view),
          roster: run.state.roster.map(view),
          poolTop: [...run.state.pool]
            .sort((a, b) => (byId.get(b) ? speciesPower(byId.get(b)!) : 0) - (byId.get(a) ? speciesPower(byId.get(a)!) : 0))
            .slice(0, 8)
            .map(view),
          poolCount: run.state.pool.length,
          field: run.state.field.map(view),
          paid: run.paid,
        }
      : null,
    freeAvailable: !freeUsed,
    entryFee: ENTRY_FEE_COINS,
    challengeRewardTaken: chalTaken,
  };
}

export async function startRunWeb(
  userId: string,
  format: FormatKind,
): Promise<{ ok: true; view: FormatView; resumed: boolean; freeEntry: boolean } | { ok: false; error: string }> {
  const existing = await activeRun(userId, format);
  if (existing) {
    return { ok: true, view: await formatView(userId, format), resumed: true, freeEntry: !existing.paid };
  }
  const fullCatalog = await loadCatalog();
  // Edition split (spec 6.38): draft/sealed pools follow the edition
  // of the player's active deck (default EN when they have none).
  const decks0 = await userDecks(userId);
  const active0 = decks0.find((d) => d.isActive) ?? decks0[0];
  let edition: CardEdition = "en";
  if (active0?.codes[0]) {
    const first = await db().query(
      `SELECT species_id FROM tcg_instances WHERE code = $1 AND user_id = $2`,
      [active0.codes[0], userId],
    );
    if (first.rows[0]) edition = speciesEdition(String(first.rows[0].species_id));
  }
  const catalog = fullCatalog.filter((s) => speciesEdition(s.id) === edition);
  if (catalog.length < 30) return { ok: false, error: "Kho thẻ chưa sẵn sàng cho hình thức này." };
  const cfg = await getTcgConfigWeb();
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const rng = Math.random;

  const dealOffers = (exclude: string[]): string[] => {
    const offers: string[] = [];
    let guard = 0;
    while (offers.length < 3 && guard++ < 60) {
      const sp = rollSpeciesId(rng, cfg.rates, catalog);
      if (sp && !exclude.includes(sp.id) && !offers.includes(sp.id)) offers.push(sp.id);
    }
    return offers;
  };

  let state: FormatRunState;
  if (format === "draft") {
    state = {
      phase: "draft", round: 1, offers: dealOffers([]),
      roster: [], pool: [], field: [], wins: 0, losses: 0, matchIndex: 0,
    };
  } else {
    const pool: string[] = [];
    for (let i = 0; i < SEALED_POOL; i++) {
      const sp = rollSpeciesId(rng, cfg.rates, catalog);
      if (sp) pool.push(sp.id);
    }
    state = {
      phase: "fight", round: DRAFT_ROUNDS + 1, offers: [],
      roster: [], pool, field: topField(pool, byId), wins: 0, losses: 0, matchIndex: 0,
    };
  }
  const status = state.phase === "draft" ? "building" : "fighting";
  const day = utcDay(new Date());

  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const claim = await client.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, $2, $3)
       ON CONFLICT DO NOTHING RETURNING user_id`,
      [userId, `formatfree:${format}`, day],
    );
    const freeEntry = claim.rows.length > 0;
    if (!freeEntry) {
      const paidOk = await adjustBalanceTx(
        client as TxClient, userId, -ENTRY_FEE_COINS, `tcg-${format}`,
        `Vào ${format === "draft" ? "Draft Arena" : "Sealed"} (web)`,
      );
      if (!paidOk) {
        await client.query("ROLLBACK");
        return {
          ok: false,
          error: `Không đủ Coins để vào lượt mới (cần ${ENTRY_FEE_COINS}). Lượt miễn phí hôm nay đã dùng — quay lại ngày mai hoặc nạp thêm Coins.`,
        };
      }
    }
    await client.query(
      `INSERT INTO tcg_format_runs (user_id, format, state, status, paid)
       VALUES ($1, $2, $3::jsonb, $4, $5)`,
      [userId, format, JSON.stringify(state), status, !freeEntry],
    );
    await client.query("COMMIT");
    return { ok: true, view: await formatView(userId, format), resumed: false, freeEntry };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function draftPickWeb(
  userId: string,
  pick: number,
): Promise<{ ok: true; view: FormatView } | { ok: false; error: string }> {
  const run = await activeRun(userId, "draft");
  if (!run) return { ok: false, error: "Bạn chưa có lượt Draft nào đang chạy — bắt đầu lượt mới trước." };
  if (run.state.phase !== "draft") {
    return { ok: false, error: "Lượt Draft này đã qua vòng chọn thẻ — đấu tiếp bằng nút Đấu trận kế." };
  }
  if (!Number.isInteger(pick) || pick < 1 || pick > run.state.offers.length) {
    return { ok: false, error: `Chọn số từ 1 đến ${run.state.offers.length}.` };
  }
  run.state.roster.push(run.state.offers[pick - 1]!);
  if (run.state.round >= DRAFT_ROUNDS) {
    const catalog = await loadCatalog();
    const byId = new Map(catalog.map((s) => [s.id, s]));
    run.state.field = topField(run.state.roster, byId);
    run.state.offers = [];
    run.state.phase = "fight";
    run.status = "fighting";
  } else {
    run.state.round += 1;
    const fullCatalog = await loadCatalog();
    // Edition split: later offers stay in the roster's edition.
    const edition = speciesEdition(run.state.roster[0]!);
    const catalog = fullCatalog.filter((s) => speciesEdition(s.id) === edition);
    const cfg = await getTcgConfigWeb();
    const offers: string[] = [];
    let guard = 0;
    while (offers.length < 3 && guard++ < 60) {
      const sp = rollSpeciesId(Math.random, cfg.rates, catalog);
      if (sp && !run.state.roster.includes(sp.id) && !offers.includes(sp.id)) offers.push(sp.id);
    }
    run.state.offers = offers;
  }
  await saveRun(run);
  return { ok: true, view: await formatView(userId, "draft") };
}

export type FightOutcome = BattleOutcome & { runDone: boolean; shards: number; wins: number; losses: number };

/* ------------- last format result, for the result block ------------
 * Same pattern as battle.ts lastBattle: rewards are committed in the
 * DB; this in-memory copy only feeds the result panel on /me/battle. */
export interface FormatEvent {
  kind: "challenge" | "fight";
  format?: FormatKind;
  win: boolean;
  rounds: number;
  log: string[];
  coins: number;
  shards: number;
  rewardClaimed?: boolean;
  runDone?: boolean;
  wins?: number;
  losses?: number;
  enemyNames: string[];
}

const lastFormatEvents = new Map<string, FormatEvent>();
export function rememberFormatEvent(userId: string, event: FormatEvent): void {
  lastFormatEvents.set(userId, event);
  if (lastFormatEvents.size > 200) {
    const oldest = lastFormatEvents.keys().next().value;
    if (oldest) lastFormatEvents.delete(oldest);
  }
}
export function lastFormatEvent(userId: string): FormatEvent | undefined {
  return lastFormatEvents.get(userId);
}

export async function fightNextWeb(
  userId: string,
  format: FormatKind,
): Promise<FightOutcome | { ok: false; error: string }> {
  const run = await activeRun(userId, format);
  if (!run) return { ok: false, error: `Bạn chưa có lượt ${format === "draft" ? "Draft" : "Sealed"} nào đang chạy.` };
  if (run.state.phase !== "fight") {
    return { ok: false, error: "Hãy chọn xong thẻ trước khi đấu." };
  }
  const catalog = await loadCatalog();
  const byId = new Map(catalog.map((s) => [s.id, s]));
  const team = run.state.field
    .map((id, i) => {
      const sp = byId.get(id);
      return sp ? phantomCard(sp, `F${run.id}-${i + 1}`) : null;
    })
    .filter((c): c is BattleCardInput => c !== null);
  if (team.length < 5) return { ok: false, error: "Đội hình của lượt này không đủ 5 thẻ hợp lệ." };
  const fieldTotal = team.reduce((s, c) => s + cardPower(c.maxHp, c.atk), 0);
  const rng = rngFromSeed(hashSeed(`run:${run.id}:match:${run.state.matchIndex}`));
  // Edition split: the chain rival stays in the field's edition.
  const edition = speciesEdition(run.state.field[0]!);
  const enemy = buildNpcTeam(catalog.filter((s) => speciesEdition(s.id) === edition), rng, fieldTotal * (0.9 + 0.25 * run.state.wins));
  const result = simulateCardBattleWeb(team, enemy, rng);
  const win = result.winner === "a";
  run.state.matchIndex += 1;
  let coins = 0;
  let shards = 0;
  if (win) {
    coins = WIN_COINS[Math.min(run.state.wins, WIN_COINS.length - 1)]!;
    run.state.wins += 1;
    if (run.state.wins >= CHAIN_WINS) {
      shards = FINAL_WIN_SHARDS;
      run.state.phase = "done";
      run.status = "done";
    }
  } else {
    run.state.losses += 1;
    if (run.state.losses >= CHAIN_LOSSES) {
      run.state.phase = "done";
      run.status = "done";
    }
  }
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    if (coins > 0) {
      await adjustBalanceTx(client as TxClient, userId, coins, `tcg-${format}`, `Thắng trận ${run.state.wins} (${format}, web)`);
    }
    if (shards > 0) await addShardsTx(client as TxClient, userId, shards);
    await client.query(
      `UPDATE tcg_format_runs SET state = $2::jsonb, status = $3, updated_at = now() WHERE id = $1`,
      [run.id, JSON.stringify(run.state), run.status],
    );
    await client.query("COMMIT");
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi ghi kết quả trận, thử lại sau." };
  } finally {
    client.release();
  }
  await bumpQuest(userId, "battle_play", 1);
  if (win) await bumpQuest(userId, "battle_win", 1);
  return {
    ok: true, win, rounds: result.rounds, log: result.log.slice(-14),
    events: result.events, coins, xp: 0, team, enemy, leveledUp: [],
    runDone: run.state.phase === "done", shards, wins: run.state.wins, losses: run.state.losses,
  };
}
