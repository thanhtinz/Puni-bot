/**
 * Global economy — spec 6.16.1.
 * ONE balance per Discord user, valid in every guild (and every white-label
 * instance). This is community money only: Puni has no shop system at all
 * wallet (real money, per guild) and from Cozy World Gems.
 *
 * Storage sits behind the EconomyStore interface:
 * - InMemoryEconomyStore — tests and token-less local runs.
 * - PgEconomyStore (db/pg-economy-store.ts) — production; every mutation is
 *   a real PostgreSQL transaction so multiple shards/clusters can never
 *   double-spend (spec 2.5).
 *
 * Invariants enforced at BOTH layers:
 * - A debit that would overdraw FAILS CLOSED: nothing is written.
 * - Every successful mutation appends a ledger entry for reconciliation.
 * - Daily can be claimed once per global day across the whole system.
 */

export interface EconomyConfig {
  /** Display name of the currency (owner-set globally, spec 6.16.1). */
  currencyName: string;
  /** Display name of the Cozy World gem currency (owner-set globally). */
  gemsName: string;
  dailyBase: number;
  dailyStreakBonus: number;
  dailyStreakBonusCap: number;
}

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  currencyName: "Coins",
  gemsName: "Gems",
  dailyBase: 100,
  dailyStreakBonus: 10,
  dailyStreakBonusCap: 100,
};

/** Normalize owner-edited economy config (Admin panel / bot_config table):
 *  junk falls back per-field to the defaults; numbers are clamped to sane
 *  ranges so a typo can never mint or freeze the economy. */
export function normalizeEconomyConfig(raw: unknown): EconomyConfig {
  const d = DEFAULT_ECONOMY_CONFIG;
  if (!raw || typeof raw !== "object") return { ...d };
  const r = raw as Record<string, unknown>;
  const int = (v: unknown, fallback: number, max: number): number => {
    const n = typeof v === "number" ? v : Number.NaN;
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(Math.trunc(n), 0), max);
  };
  const name =
    typeof r.currencyName === "string" && r.currencyName.trim() !== ""
      ? r.currencyName.trim().slice(0, 24)
      : d.currencyName;
  const gemsName =
    typeof r.gemsName === "string" && r.gemsName.trim() !== ""
      ? r.gemsName.trim().slice(0, 24)
      : d.gemsName;
  return {
    currencyName: name,
    gemsName,
    dailyBase: int(r.dailyBase, d.dailyBase, 1_000_000),
    dailyStreakBonus: int(r.dailyStreakBonus, d.dailyStreakBonus, 100_000),
    dailyStreakBonusCap: int(r.dailyStreakBonusCap, d.dailyStreakBonusCap, 1_000_000),
  };
}

export interface EconomyAccount {
  userId: string;
  balance: number;
  lastDailyDay: string | null; // YYYY-MM-DD (global day key)
  dailyStreak: number;
}

export interface LedgerEntry {
  id: number;
  userId: string;
  delta: number;
  balanceAfter: number;
  /** e.g. "daily", "game", "cozy-farm", "admin", "transfer" */
  source: string;
  note: string;
  createdAt: Date;
}

export class InsufficientFundsError extends Error {
  constructor(userId: string, balance: number, needed: number) {
    super(`Insufficient funds for ${userId}: balance ${balance}, needed ${needed}`);
    this.name = "InsufficientFundsError";
  }
}

/** Day key in a fixed global timezone so "once per day" is system-wide,
 *  not per-server-local. Uses UTC; the owner can re-anchor later. */
export function globalDayKey(at: Date = new Date()): string {
  return at.toISOString().slice(0, 10);
}

export function previousDayKey(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export interface EconomyStore {
  getBalance(userId: string): Promise<number>;
  /** Apply a signed delta atomically. When `requireFunds` is set, a result
   *  below zero throws InsufficientFundsError and writes nothing. */
  applyDelta(input: {
    userId: string;
    delta: number;
    source: string;
    note: string;
    requireFunds?: boolean;
  }): Promise<LedgerEntry>;
  /** Both sides land or neither does. Throws InsufficientFundsError. */
  transfer(fromId: string, toId: string, amount: number, note: string): Promise<void>;
  /** Atomically claim today's daily. `rewardFor` maps the NEW streak to the
   *  reward amount, computed inside the atomic operation. Returns null when
   *  today was already claimed. */
  claimDaily(input: {
    userId: string;
    today: string;
    yesterday: string;
    rewardFor: (streak: number) => number;
  }): Promise<{ amount: number; streak: number } | null>;
  top(limit: number): Promise<EconomyAccount[]>;
  ledgerFor(userId: string): Promise<LedgerEntry[]>;
}

/** In-memory store: a promise-chain mutex serializes mutations in-process. */
export class InMemoryEconomyStore implements EconomyStore {
  private accounts = new Map<string, EconomyAccount>();
  private ledger: LedgerEntry[] = [];
  private nextLedgerId = 1;
  private chain: Promise<void> = Promise.resolve();

  private runExclusive<T>(fn: () => T): Promise<T> {
    let result!: T;
    const run = this.chain.then(() => {
      result = fn();
    });
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run.then(() => result);
  }

  private account(userId: string): EconomyAccount {
    let acc = this.accounts.get(userId);
    if (!acc) {
      acc = { userId, balance: 0, lastDailyDay: null, dailyStreak: 0 };
      this.accounts.set(userId, acc);
    }
    return acc;
  }

  private apply(acc: EconomyAccount, delta: number, source: string, note: string): LedgerEntry {
    acc.balance += delta;
    const entry: LedgerEntry = {
      id: this.nextLedgerId++,
      userId: acc.userId,
      delta,
      balanceAfter: acc.balance,
      source,
      note,
      createdAt: new Date(),
    };
    this.ledger.push(entry);
    return entry;
  }

  async getBalance(userId: string): Promise<number> {
    return this.accounts.get(userId)?.balance ?? 0;
  }

  async applyDelta(input: {
    userId: string;
    delta: number;
    source: string;
    note: string;
    requireFunds?: boolean;
  }): Promise<LedgerEntry> {
    return this.runExclusive(() => {
      const acc = this.account(input.userId);
      if (input.requireFunds && acc.balance + input.delta < 0) {
        throw new InsufficientFundsError(input.userId, acc.balance, -input.delta);
      }
      return this.apply(acc, input.delta, input.source, input.note);
    });
  }

  async transfer(fromId: string, toId: string, amount: number, note: string): Promise<void> {
    await this.runExclusive(() => {
      const from = this.account(fromId);
      if (from.balance < amount) throw new InsufficientFundsError(fromId, from.balance, amount);
      this.apply(from, -amount, "transfer", note || `to ${toId}`);
      this.apply(this.account(toId), amount, "transfer", note || `from ${fromId}`);
    });
  }

  async claimDaily(input: {
    userId: string;
    today: string;
    yesterday: string;
    rewardFor: (streak: number) => number;
  }): Promise<{ amount: number; streak: number } | null> {
    return this.runExclusive(() => {
      const acc = this.account(input.userId);
      if (acc.lastDailyDay === input.today) return null;
      acc.dailyStreak = acc.lastDailyDay === input.yesterday ? acc.dailyStreak + 1 : 1;
      acc.lastDailyDay = input.today;
      const amount = input.rewardFor(acc.dailyStreak);
      this.apply(acc, amount, "daily", `streak ${acc.dailyStreak}`);
      return { amount, streak: acc.dailyStreak };
    });
  }

  async top(limit = 10): Promise<EconomyAccount[]> {
    return [...this.accounts.values()]
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  async ledgerFor(userId: string): Promise<LedgerEntry[]> {
    return this.ledger.filter((e) => e.userId === userId);
  }
}

/** Business-logic layer used by commands: validates amounts, owns the
 *  daily reward formula, delegates atomicity to the store. */
export class EconomyService {
  constructor(
    private store: EconomyStore = new InMemoryEconomyStore(),
    private config: EconomyConfig = DEFAULT_ECONOMY_CONFIG,
    /** Live config source (Admin panel edits): consulted on every daily
     *  claim; the provider caches, so this stays cheap. */
    private configSource?: () => Promise<EconomyConfig>,
  ) {}

  private async liveConfig(): Promise<EconomyConfig> {
    if (!this.configSource) return this.config;
    try {
      return await this.configSource();
    } catch {
      return this.config;
    }
  }

  getBalance(userId: string): Promise<number> {
    return this.store.getBalance(userId);
  }

  async credit(userId: string, amount: number, source: string, note = ""): Promise<LedgerEntry> {
    if (!Number.isInteger(amount) || amount <= 0)
      throw new Error("credit amount must be a positive integer");
    return this.store.applyDelta({ userId, delta: amount, source, note });
  }

  async debit(userId: string, amount: number, source: string, note = ""): Promise<LedgerEntry> {
    if (!Number.isInteger(amount) || amount <= 0)
      throw new Error("debit amount must be a positive integer");
    return this.store.applyDelta({ userId, delta: -amount, source, note, requireFunds: true });
  }

  async transfer(fromId: string, toId: string, amount: number, note = ""): Promise<void> {
    if (fromId === toId) throw new Error("Cannot transfer to self");
    if (!Number.isInteger(amount) || amount <= 0)
      throw new Error("transfer amount must be a positive integer");
    return this.store.transfer(fromId, toId, amount, note);
  }

  async claimDaily(
    userId: string,
    at: Date = new Date(),
  ): Promise<{ amount: number; streak: number } | null> {
    const cfg = await this.liveConfig();
    const today = globalDayKey(at);
    return this.store.claimDaily({
      userId,
      today,
      yesterday: previousDayKey(today),
      rewardFor: (streak) =>
        cfg.dailyBase +
        Math.min((streak - 1) * cfg.dailyStreakBonus, cfg.dailyStreakBonusCap),
    });
  }

  top(limit = 10): Promise<EconomyAccount[]> {
    return this.store.top(limit);
  }

  ledgerFor(userId: string): Promise<LedgerEntry[]> {
    return this.store.ledgerFor(userId);
  }
}
