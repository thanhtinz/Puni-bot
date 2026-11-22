/**
 * TCG battle formats (spec 6.38): Daily Challenge, Draft Arena and
 * Sealed — one state machine over tcg_format_runs, shared verbatim
 * with the dashboard (dashboard/src/lib/formats.ts mirrors this file;
 * the run state JSON is the contract between the two surfaces).
 *
 * Rules locked in spec 6.38:
 * - Daily Challenge: a deterministic NPC team per (day, player),
 *   seeded from the day + user id, scaled to ~105% of the player's
 *   active-deck power. Free to attempt all day; the win reward
 *   (200 Coins + 5 shards) claims once per UTC day via tcg_claims
 *   kind 'dailychal'. The battle itself is seeded too, so the result
 *   is identical on every surface and every retry.
 * - Draft Arena: 8 rounds of pick-1-of-3 phantom species (rarity
 *   rolled with the normal gacha rates, no pity), then the top 5 by
 *   power fight a chain: first to 3 wins or 2 losses ends the run.
 * - Sealed: a 30-card phantom pool rolled the same way; top 5 fight
 *   the same chain.
 * - Draft/Sealed entry: first run of each format per UTC day is free
 *   (tcg_claims kind 'formatfree:<format>'); further runs cost
 *   ENTRY_FEE_COINS, debited explicitly — a failed debit starts
 *   nothing. Win rewards pay per match: 150 / 220 / 320 Coins, the
 *   3rd win adds 10 shards. Phantom cards are never owned instances.
 */
import {
  emptyPity,
  pickSpecies,
  rollRarity,
  speciesEdition,
  type CardEdition,
  type TcgConfig,
  type TcgSpecies,
} from "./tcg";
import type { TcgEconomyHooks, TcgStore } from "./tcg-store";
import { battleStatsFor, simulateCardBattle, type BattleCardInput } from "./tcg-battle";

export type FormatKind = "draft" | "sealed";

export interface FormatRunState {
  phase: "draft" | "fight" | "done";
  /** Draft round, 1..DRAFT_ROUNDS (draft phase only). */
  round: number;
  /** The 3 species currently offered (draft phase only). */
  offers: string[];
  /** Drafted species, in pick order (draft runs). */
  roster: string[];
  /** The 30 rolled species (sealed runs). */
  pool: string[];
  /** The 5 species fighting the chain. */
  field: string[];
  wins: number;
  losses: number;
  /** Increments on every fight — seeds the next NPC team. */
  matchIndex: number;
}

export interface FormatRun {
  id: number;
  userId: string;
  format: FormatKind;
  state: FormatRunState;
  status: "building" | "fighting" | "done";
  paid: boolean;
  createdAt: Date;
  expiresAt: Date;
}

export interface FormatStore {
  activeRun(userId: string, format: FormatKind): Promise<FormatRun | null>;
  createRun(userId: string, format: FormatKind, state: FormatRunState, paid: boolean): Promise<FormatRun>;
  saveRun(run: FormatRun): Promise<void>;
  claimOnce(userId: string, kind: string, period: string): Promise<boolean>;
  hasClaimed(userId: string, kind: string, period: string): Promise<boolean>;
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

/** UTC day key, the period format of tcg_claims rows. */
export const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

/* ---------------- deterministic RNG (mirrored in the dashboard) -- */

/** FNV-1a string hash — the seed source for every deterministic roll. */
export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 — same seed, same sequence, on every surface. */
export function rngFromSeed(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ---------------- team building ---------------------------------- */

/** One number to compare card strength by: HP plus attack weight. */
export const cardPower = (maxHp: number, atk: number): number => maxHp + atk * 10;

export function speciesPower(sp: TcgSpecies): number {
  const s = battleStatsFor(sp.baseHp ?? 50, sp.baseAtk ?? 50, 1, 0);
  return cardPower(s.maxHp, s.atk);
}

function phantomCard(sp: TcgSpecies, code: string): BattleCardInput {
  const s = battleStatsFor(sp.baseHp ?? 50, sp.baseAtk ?? 50, 1, 0);
  return { code, name: sp.name, speciesId: sp.id, ...s };
}

/**
 * Build a 5-card NPC team whose total power lands near targetTotal:
 * shuffle the catalog with the given RNG, prefer species whose base
 * power sits in a sane band around the per-card target, then scale
 * the whole team's stats by one clamped factor to hit the target.
 */
export function buildNpcTeam(
  catalog: TcgSpecies[],
  rng: () => number,
  targetTotal: number,
): BattleCardInput[] {
  // Sorted by id first: the seeded shuffle must start from the same
  // order on every surface, whatever order the catalog query used.
  const usable = catalog
    .filter((s) => (s.baseHp ?? 0) > 0 && (s.baseAtk ?? 0) > 0)
    .sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  if (usable.length === 0) return [];
  const deck = [...usable];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  const per = targetTotal / 5;
  const picked: TcgSpecies[] = [];
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

/** The daily-challenge opponent for one player: fully deterministic. */
export function dailyOpponent(
  catalog: TcgSpecies[],
  day: string,
  userId: string,
  playerTotalPower: number,
): BattleCardInput[] {
  const rng = rngFromSeed(hashSeed(`dailychal:${day}:${userId}`));
  return buildNpcTeam(catalog, rng, playerTotalPower * 1.05);
}

/* ---------------- in-memory store (tests / no-DB mode) ----------- */

export class InMemoryFormatStore implements FormatStore {
  private runs: FormatRun[] = [];
  private claims = new Set<string>();
  private nextId = 1;

  async activeRun(userId: string, format: FormatKind): Promise<FormatRun | null> {
    const open = this.runs
      .filter((r) => r.userId === userId && r.format === format && r.status !== "done")
      .sort((a, b) => b.id - a.id);
    return open[0] ?? null;
  }

  async createRun(userId: string, format: FormatKind, state: FormatRunState, paid: boolean): Promise<FormatRun> {
    const run: FormatRun = {
      id: this.nextId++,
      userId,
      format,
      state,
      status: state.phase === "draft" ? "building" : state.phase === "fight" ? "fighting" : "done",
      paid,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 24 * 3600 * 1000),
    };
    this.runs.push(run);
    return run;
  }

  async saveRun(run: FormatRun): Promise<void> {
    const i = this.runs.findIndex((r) => r.id === run.id);
    if (i >= 0) this.runs[i] = run;
  }

  async claimOnce(userId: string, kind: string, period: string): Promise<boolean> {
    const key = `${userId}|${kind}|${period}`;
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }

  async hasClaimed(userId: string, kind: string, period: string): Promise<boolean> {
    return this.claims.has(`${userId}|${kind}|${period}`);
  }
}

/* ---------------- the game service ------------------------------- */

export interface TcgFormatsDeps {
  store: TcgStore;
  formats: FormatStore;
  catalog: () => Promise<TcgSpecies[]>;
  config: () => Promise<TcgConfig>;
  economy: TcgEconomyHooks;
  /** Quest progress hook (spec 6.38) — wired when quests are live. */
  onAction?: (userId: string, action: string, n: number) => Promise<void>;
  now?: () => Date;
}

type Err = { kind: "error"; message: string };

export class TcgFormatsGame {
  constructor(private readonly deps: TcgFormatsDeps) {}

  private now(): Date {
    return this.deps.now ? this.deps.now() : new Date();
  }

  private async action(userId: string, action: string, n: number): Promise<void> {
    try {
      await this.deps.onAction?.(userId, action, n);
    } catch {
      /* quest progress must never break gameplay */
    }
  }

  /** The player's own battle team: first 5 cards of the active deck. */
  private async playerTeam(
    userId: string,
  ): Promise<{ team: BattleCardInput[]; totalPower: number } | Err> {
    const decks = await this.deps.store.listDecks(userId);
    const active = decks.find((d) => d.isActive) ?? decks[0];
    if (!active) {
      return { kind: "error", message: "Bạn chưa có bộ bài nào — tạo bộ bài trước khi đấu." };
    }
    if (active.codes.length < 5) {
      return { kind: "error", message: `Bộ bài "${active.name}" mới có ${active.codes.length} thẻ — cần ít nhất 5 thẻ để đấu.` };
    }
    const byId = new Map((await this.deps.catalog()).map((s) => [s.id, s]));
    const team: BattleCardInput[] = [];
    for (const code of active.codes.slice(0, 5)) {
      const inst = await this.deps.store.getInstance(code);
      if (!inst || inst.userId !== userId) continue;
      const sp = byId.get(inst.speciesId);
      const stats = battleStatsFor(sp?.baseHp ?? 50, sp?.baseAtk ?? 50, inst.level, inst.enhance);
      team.push({ code: inst.code, name: sp?.name ?? inst.speciesId, speciesId: inst.speciesId, ...stats });
    }
    if (team.length < 5) {
      return { kind: "error", message: "Bộ bài đang dùng thiếu thẻ hợp lệ — kiểm tra lại bộ bài." };
    }
    return { team, totalPower: team.reduce((s, c) => s + cardPower(c.maxHp, c.atk), 0) };
  }

  /** Edition of the player's active deck (first card), default EN. */
  private async playerEdition(userId: string): Promise<CardEdition> {
    const decks = await this.deps.store.listDecks(userId);
    const active = decks.find((d) => d.isActive) ?? decks[0];
    const first = active?.codes[0];
    if (!first) return "en";
    const inst = await this.deps.store.getInstance(first);
    return inst ? speciesEdition(inst.speciesId) : "en";
  }

  /* -------------- Daily Challenge -------------- */

  async dailyChallenge(userId: string): Promise<
    | {
        kind: "ok";
        win: boolean;
        rounds: number;
        log: string[];
        teamNames: string[];
        enemyNames: string[];
        coins: number;
        shards: number;
        rewardClaimed: boolean;
      }
    | Err
  > {
    const mine = await this.playerTeam(userId);
    if ("kind" in mine) return mine;
    const catalog = await this.deps.catalog();
    const day = utcDay(this.now());
    // Edition split (spec 6.38): the daily rival uses the player's edition.
    const edition = speciesEdition(mine.team[0]!.speciesId);
    const enemy = dailyOpponent(catalog.filter((s) => speciesEdition(s.id) === edition), day, userId, mine.totalPower);
    if (enemy.length < 5) {
      return { kind: "error", message: "Kho thẻ chưa sẵn sàng cho thử thách ngày." };
    }
    const rng = rngFromSeed(hashSeed(`dailychal-battle:${day}:${userId}`));
    const result = simulateCardBattle(mine.team, enemy, rng);
    const win = result.winner === "a";
    await this.action(userId, "battle_play", 1);
    let coins = 0;
    let shards = 0;
    let rewardClaimed = false;
    if (win) {
      await this.action(userId, "battle_win", 1);
      await this.action(userId, "challenge_win", 1);
      rewardClaimed = await this.deps.formats.claimOnce(userId, "dailychal", day);
      if (rewardClaimed) {
        coins = CHALLENGE_COINS;
        shards = CHALLENGE_SHARDS;
        await this.deps.economy.credit(userId, coins, "tcg-challenge", "Thắng thử thách ngày");
        await this.deps.store.adjustWallet(userId, { shards });
      }
    }
    return {
      kind: "ok",
      win,
      rounds: result.rounds,
      log: result.log,
      teamNames: mine.team.map((c) => c.name),
      enemyNames: enemy.map((c) => c.name),
      coins,
      shards,
      rewardClaimed,
    };
  }

  async challengeRewardTaken(userId: string): Promise<boolean> {
    return this.deps.formats.hasClaimed(userId, "dailychal", utcDay(this.now()));
  }

  /* -------------- Draft / Sealed runs -------------- */

  private rollSpecies(rng: () => number, cfg: TcgConfig, catalog: TcgSpecies[]): TcgSpecies | null {
    const rarity = rollRarity(rng, cfg, emptyPity());
    return pickSpecies(rng, catalog, rarity, []);
  }

  private dealOffers(
    rng: () => number,
    cfg: TcgConfig,
    catalog: TcgSpecies[],
    exclude: string[],
  ): string[] {
    const offers: string[] = [];
    let guard = 0;
    while (offers.length < 3 && guard++ < 60) {
      const sp = this.rollSpecies(rng, cfg, catalog);
      if (sp && !exclude.includes(sp.id) && !offers.includes(sp.id)) offers.push(sp.id);
    }
    return offers;
  }

  private topField(speciesIds: string[], byId: Map<string, TcgSpecies>): string[] {
    return [...speciesIds]
      .sort((a, b) => speciesPower(byId.get(b)!) - speciesPower(byId.get(a)!))
      .slice(0, 5);
  }

  async startRun(userId: string, format: FormatKind): Promise<
    | { kind: "ok"; run: FormatRun; resumed: boolean; freeEntry: boolean }
    | Err
  > {
    const existing = await this.deps.formats.activeRun(userId, format);
    if (existing) {
      if (existing.expiresAt > this.now()) {
        return { kind: "ok", run: existing, resumed: true, freeEntry: !existing.paid };
      }
      existing.state.phase = "done";
      existing.status = "done";
      await this.deps.formats.saveRun(existing);
    }
    const fullCatalog = await this.deps.catalog();
    // Edition split (spec 6.38): draft/sealed pools follow the edition
    // of the player's active deck (default EN when they have none).
    const edition = await this.playerEdition(userId);
    const catalog = fullCatalog.filter((s) => speciesEdition(s.id) === edition);
    if (catalog.length < 30) {
      return { kind: "error", message: "Kho thẻ chưa sẵn sàng cho hình thức này." };
    }
    const day = utcDay(this.now());
    const freeEntry = await this.deps.formats.claimOnce(userId, `formatfree:${format}`, day);
    let paid = false;
    if (!freeEntry) {
      paid = true;
      const ok = await this.deps.economy.debit(
        userId, ENTRY_FEE_COINS, `tcg-${format}`, `Vào ${format === "draft" ? "Draft Arena" : "Sealed"}`,
      );
      if (!ok) {
        return {
          kind: "error",
          message: `Không đủ Coins để vào lượt mới (cần ${ENTRY_FEE_COINS}). Lượt miễn phí hôm nay đã dùng — quay lại ngày mai hoặc nạp thêm Coins.`,
        };
      }
    }
    const cfg = await this.deps.config();
    const rng = Math.random;
    let state: FormatRunState;
    if (format === "draft") {
      state = {
        phase: "draft", round: 1,
        offers: this.dealOffers(rng, cfg, catalog, []),
        roster: [], pool: [], field: [], wins: 0, losses: 0, matchIndex: 0,
      };
    } else {
      const pool: string[] = [];
      for (let i = 0; i < SEALED_POOL; i++) {
        const sp = this.rollSpecies(rng, cfg, catalog);
        if (sp) pool.push(sp.id);
      }
      const byId = new Map(catalog.map((s) => [s.id, s]));
      state = {
        phase: "fight", round: DRAFT_ROUNDS + 1,
        offers: [], roster: [], pool,
        field: this.topField(pool, byId),
        wins: 0, losses: 0, matchIndex: 0,
      };
    }
    const run = await this.deps.formats.createRun(userId, format, state, paid);
    return { kind: "ok", run, resumed: false, freeEntry };
  }

  async currentRun(userId: string, format: FormatKind): Promise<FormatRun | null> {
    const run = await this.deps.formats.activeRun(userId, format);
    if (run && run.expiresAt <= this.now()) {
      run.state.phase = "done";
      run.status = "done";
      await this.deps.formats.saveRun(run);
      return null;
    }
    return run;
  }

  async draftPick(userId: string, pick: number): Promise<{ kind: "ok"; run: FormatRun } | Err> {
    const run = await this.currentRun(userId, "draft");
    if (!run) return { kind: "error", message: "Bạn chưa có lượt Draft nào đang chạy — dùng `draft start` để bắt đầu." };
    if (run.state.phase !== "draft") {
      return { kind: "error", message: "Lượt Draft này đã qua vòng chọn thẻ — dùng `draft fight` để đấu." };
    }
    if (!Number.isInteger(pick) || pick < 1 || pick > run.state.offers.length) {
      return { kind: "error", message: `Chọn số từ 1 đến ${run.state.offers.length}.` };
    }
    run.state.roster.push(run.state.offers[pick - 1]!);
    if (run.state.round >= DRAFT_ROUNDS) {
      const byId = new Map((await this.deps.catalog()).map((s) => [s.id, s]));
      run.state.field = this.topField(run.state.roster, byId);
      run.state.offers = [];
      run.state.phase = "fight";
      run.status = "fighting";
    } else {
      run.state.round += 1;
      const cfg = await this.deps.config();
      // Edition split: later offers stay in the roster's edition.
      const edition = speciesEdition(run.state.roster[0]!);
      const pool = (await this.deps.catalog()).filter((s) => speciesEdition(s.id) === edition);
      run.state.offers = this.dealOffers(Math.random, cfg, pool, run.state.roster);
    }
    await this.deps.formats.saveRun(run);
    return { kind: "ok", run };
  }

  async fightNext(userId: string, format: FormatKind): Promise<
    | {
        kind: "ok";
        run: FormatRun;
        win: boolean;
        rounds: number;
        log: string[];
        enemyNames: string[];
        coins: number;
        shards: number;
        runDone: boolean;
      }
    | Err
  > {
    const run = await this.currentRun(userId, format);
    if (!run) {
      return { kind: "error", message: `Bạn chưa có lượt ${format === "draft" ? "Draft" : "Sealed"} nào đang chạy.` };
    }
    if (run.state.phase !== "fight") {
      return { kind: "error", message: "Hãy chọn xong thẻ trước khi đấu (dùng `draft pick <số>`)." };
    }
    const catalog = await this.deps.catalog();
    const byId = new Map(catalog.map((s) => [s.id, s]));
    const team = run.state.field
      .map((id, i) => {
        const sp = byId.get(id);
        return sp ? phantomCard(sp, `F${run.id}-${i + 1}`) : null;
      })
      .filter((c): c is BattleCardInput => c !== null);
    if (team.length < 5) {
      return { kind: "error", message: "Đội hình của lượt này không đủ 5 thẻ hợp lệ." };
    }
    const fieldTotal = team.reduce((s, c) => s + cardPower(c.maxHp, c.atk), 0);
    const rng = rngFromSeed(hashSeed(`run:${run.id}:match:${run.state.matchIndex}`));
    // Edition split: the chain rival stays in the field's edition.
    const edition = speciesEdition(run.state.field[0]!);
    const enemy = buildNpcTeam(catalog.filter((s) => speciesEdition(s.id) === edition), rng, fieldTotal * (0.9 + 0.25 * run.state.wins));
    const result = simulateCardBattle(team, enemy, rng);
    const win = result.winner === "a";
    run.state.matchIndex += 1;
    await this.action(userId, "battle_play", 1);
    let coins = 0;
    let shards = 0;
    if (win) {
      await this.action(userId, "battle_win", 1);
      coins = WIN_COINS[Math.min(run.state.wins, WIN_COINS.length - 1)]!;
      run.state.wins += 1;
      await this.deps.economy.credit(userId, coins, `tcg-${format}`, `Thắng trận ${run.state.wins} (${format})`);
      if (run.state.wins >= CHAIN_WINS) {
        shards = FINAL_WIN_SHARDS;
        await this.deps.store.adjustWallet(userId, { shards });
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
    await this.deps.formats.saveRun(run);
    return {
      kind: "ok",
      run,
      win,
      rounds: result.rounds,
      log: result.log,
      enemyNames: enemy.map((c) => c.name),
      coins,
      shards,
      runDone: run.state.phase === "done",
    };
  }
}
