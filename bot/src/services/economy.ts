/**
 * Global economy — spec 6.16.1.
 * ONE balance per Discord user, valid in every guild (and every white-label
 * instance). This is community money only: it is fully separate from the
 * Shop wallet (real money, per guild) and from Cozy World Gems.
 *
 * Invariants enforced here:
 * - Every mutation is serialized (in-memory mutex now; the PostgreSQL store
 *   will use a transaction + row lock behind the same interface).
 * - A debit that would overdraw FAILS CLOSED: nothing is written.
 * - Every successful mutation appends a ledger entry for reconciliation.
 * - Daily can be claimed once per global day across the whole system.
 */

export interface EconomyConfig {
  /** Display name of the currency (owner-set globally, spec 6.16.1). */
  currencyName: string;
  dailyBase: number;
  dailyStreakBonus: number;
  dailyStreakBonusCap: number;
}

export const DEFAULT_ECONOMY_CONFIG: EconomyConfig = {
  currencyName: "Coins",
  dailyBase: 100,
  dailyStreakBonus: 10,
  dailyStreakBonusCap: 100,
};

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

function previousDayKey(dayKey: string): string {
  const d = new Date(`${dayKey}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export class EconomyService {
  private accounts = new Map<string, EconomyAccount>();
  private ledger: LedgerEntry[] = [];
  private nextLedgerId = 1;
  /** Promise-chain mutex: serializes every mutation in this process.
   *  Cross-process atomicity comes from the DB store (spec 2.5). */
  private chain: Promise<void> = Promise.resolve();

  constructor(private config: EconomyConfig = DEFAULT_ECONOMY_CONFIG) {}

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

  async credit(userId: string, amount: number, source: string, note = ""): Promise<LedgerEntry> {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("credit amount must be a positive integer");
    return this.runExclusive(() => this.apply(this.account(userId), amount, source, note));
  }

  async debit(userId: string, amount: number, source: string, note = ""): Promise<LedgerEntry> {
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("debit amount must be a positive integer");
    return this.runExclusive(() => {
      const acc = this.account(userId);
      if (acc.balance < amount) throw new InsufficientFundsError(userId, acc.balance, amount);
      return this.apply(acc, -amount, source, note);
    });
  }

  /** Transfer between two users atomically: either both sides land or neither. */
  async transfer(fromId: string, toId: string, amount: number, note = ""): Promise<void> {
    if (fromId === toId) throw new Error("Cannot transfer to self");
    if (!Number.isInteger(amount) || amount <= 0) throw new Error("transfer amount must be a positive integer");
    await this.runExclusive(() => {
      const from = this.account(fromId);
      if (from.balance < amount) throw new InsufficientFundsError(fromId, from.balance, amount);
      this.apply(from, -amount, "transfer", note || `to ${toId}`);
      this.apply(this.account(toId), amount, "transfer", note || `from ${fromId}`);
    });
  }

  /** Claim the global daily reward. Returns null when already claimed today. */
  async claimDaily(userId: string, at: Date = new Date()): Promise<{ amount: number; streak: number } | null> {
    const today = globalDayKey(at);
    return this.runExclusive(() => {
      const acc = this.account(userId);
      if (acc.lastDailyDay === today) return null;
      acc.dailyStreak = acc.lastDailyDay === previousDayKey(today) ? acc.dailyStreak + 1 : 1;
      acc.lastDailyDay = today;
      const bonus = Math.min((acc.dailyStreak - 1) * this.config.dailyStreakBonus, this.config.dailyStreakBonusCap);
      const amount = this.config.dailyBase + bonus;
      this.apply(acc, amount, "daily", `streak ${acc.dailyStreak}`);
      return { amount, streak: acc.dailyStreak };
    });
  }

  /** Leaderboard snapshot (global). */
  async top(limit = 10): Promise<EconomyAccount[]> {
    return [...this.accounts.values()]
      .sort((a, b) => b.balance - a.balance)
      .slice(0, limit)
      .map((a) => ({ ...a }));
  }

  ledgerFor(userId: string): LedgerEntry[] {
    return this.ledger.filter((e) => e.userId === userId);
  }
}
