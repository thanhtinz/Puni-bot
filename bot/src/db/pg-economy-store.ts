/**
 * PostgreSQL economy store — production implementation of EconomyStore.
 * Every mutation runs in a transaction with SELECT ... FOR UPDATE on the
 * account row, so concurrent shards/clusters serialize on the row and can
 * never double-spend (spec 2.5). A funds-checked debit that would overdraw
 * rolls back and writes nothing (fail-closed).
 */
import type { Pool, PoolClient } from "pg";
import {
  InsufficientFundsError,
  type EconomyAccount,
  type EconomyStore,
  type LedgerEntry,
} from "../services/economy";

interface AccountRow {
  user_id: string;
  balance: string;
  last_daily_day: string | null;
  daily_streak: number;
}

function toAccount(row: AccountRow): EconomyAccount {
  return {
    userId: row.user_id,
    balance: Number(row.balance),
    lastDailyDay: row.last_daily_day,
    dailyStreak: row.daily_streak,
  };
}

export class PgEconomyStore implements EconomyStore {
  constructor(private pool: Pool) {}

  private async withTx<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      const result = await fn(client);
      await client.query("COMMIT");
      return result;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  /** Insert the account row if missing, then lock it and return it. */
  private async lockAccount(client: PoolClient, userId: string): Promise<EconomyAccount> {
    await client.query(
      "INSERT INTO economy_accounts (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING",
      [userId],
    );
    const res = await client.query<AccountRow>(
      "SELECT user_id, balance, last_daily_day, daily_streak FROM economy_accounts WHERE user_id = $1 FOR UPDATE",
      [userId],
    );
    return toAccount(res.rows[0]);
  }

  private async applyLocked(
    client: PoolClient,
    acc: EconomyAccount,
    delta: number,
    source: string,
    note: string,
  ): Promise<LedgerEntry> {
    const newBalance = acc.balance + delta;
    await client.query(
      "UPDATE economy_accounts SET balance = $2, updated_at = now() WHERE user_id = $1",
      [acc.userId, newBalance],
    );
    const res = await client.query<{ id: string; created_at: Date }>(
      `INSERT INTO economy_ledger (user_id, delta, balance_after, source, note)
       VALUES ($1, $2, $3, $4, $5) RETURNING id, created_at`,
      [acc.userId, delta, newBalance, source, note],
    );
    acc.balance = newBalance;
    return {
      id: Number(res.rows[0].id),
      userId: acc.userId,
      delta,
      balanceAfter: newBalance,
      source,
      note,
      createdAt: res.rows[0].created_at,
    };
  }

  async getBalance(userId: string): Promise<number> {
    const res = await this.pool.query<{ balance: string }>(
      "SELECT balance FROM economy_accounts WHERE user_id = $1",
      [userId],
    );
    return res.rows.length ? Number(res.rows[0].balance) : 0;
  }

  async applyDelta(input: {
    userId: string;
    delta: number;
    source: string;
    note: string;
    requireFunds?: boolean;
  }): Promise<LedgerEntry> {
    return this.withTx(async (client) => {
      const acc = await this.lockAccount(client, input.userId);
      if (input.requireFunds && acc.balance + input.delta < 0) {
        throw new InsufficientFundsError(input.userId, acc.balance, -input.delta);
      }
      return this.applyLocked(client, acc, input.delta, input.source, input.note);
    });
  }

  async transfer(fromId: string, toId: string, amount: number, note: string): Promise<void> {
    await this.withTx(async (client) => {
      // Lock in a deterministic order to avoid deadlocks between
      // opposite-direction transfers.
      const [first, second] = fromId < toId ? [fromId, toId] : [toId, fromId];
      const accFirst = await this.lockAccount(client, first);
      const accSecond = await this.lockAccount(client, second);
      const from = fromId === first ? accFirst : accSecond;
      const to = toId === first ? accFirst : accSecond;
      if (from.balance < amount) {
        throw new InsufficientFundsError(fromId, from.balance, amount);
      }
      await this.applyLocked(client, from, -amount, "transfer", note || `to ${toId}`);
      await this.applyLocked(client, to, amount, "transfer", note || `from ${fromId}`);
    });
  }

  async claimDaily(input: {
    userId: string;
    today: string;
    yesterday: string;
    rewardFor: (streak: number) => number;
  }): Promise<{ amount: number; streak: number } | null> {
    return this.withTx(async (client) => {
      const acc = await this.lockAccount(client, input.userId);
      if (acc.lastDailyDay === input.today) return null;
      const streak = acc.lastDailyDay === input.yesterday ? acc.dailyStreak + 1 : 1;
      const amount = input.rewardFor(streak);
      await client.query(
        "UPDATE economy_accounts SET last_daily_day = $2, daily_streak = $3 WHERE user_id = $1",
        [input.userId, input.today, streak],
      );
      acc.lastDailyDay = input.today;
      acc.dailyStreak = streak;
      await this.applyLocked(client, acc, amount, "daily", `streak ${streak}`);
      return { amount, streak };
    });
  }

  async top(limit: number): Promise<EconomyAccount[]> {
    const res = await this.pool.query<AccountRow>(
      `SELECT user_id, balance, last_daily_day, daily_streak
       FROM economy_accounts ORDER BY balance DESC LIMIT $1`,
      [limit],
    );
    return res.rows.map(toAccount);
  }

  async ledgerFor(userId: string): Promise<LedgerEntry[]> {
    const res = await this.pool.query<{
      id: string;
      user_id: string;
      delta: string;
      balance_after: string;
      source: string;
      note: string;
      created_at: Date;
    }>(
      `SELECT id, user_id, delta, balance_after, source, note, created_at
       FROM economy_ledger WHERE user_id = $1 ORDER BY id`,
      [userId],
    );
    return res.rows.map((r) => ({
      id: Number(r.id),
      userId: r.user_id,
      delta: Number(r.delta),
      balanceAfter: Number(r.balance_after),
      source: r.source,
      note: r.note,
      createdAt: r.created_at,
    }));
  }
}
