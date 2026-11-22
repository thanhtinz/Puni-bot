import type { Pool } from "pg";
import { VOTE_WINDOW_MS, type VoteRecord, type VoteStore } from "../services/vote";

interface Row {
  user_id: string;
  reward: string;
  is_weekend: boolean;
  created_at: Date;
}

const toRecord = (r: Row): VoteRecord => ({
  userId: r.user_id,
  reward: Number.parseInt(r.reward, 10),
  isWeekend: r.is_weekend,
  at: r.created_at,
});

/**
 * PostgreSQL VoteStore. record() runs in one transaction with the
 * user's latest vote locked by an advisory lock keyed on the user
 * id, so two webhook deliveries racing each other cannot both pass
 * the 12-hour dedupe window.
 */
export class PgVoteStore implements VoteStore {
  constructor(private readonly pool: Pool) {}

  async record(rec: VoteRecord): Promise<VoteRecord | null> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(hashtext($1))", [`vote:${rec.userId}`]);
      const last = await client.query<Row>(
        `SELECT user_id, reward::text AS reward, is_weekend, created_at
         FROM vote_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
        [rec.userId],
      );
      const prev = last.rows[0];
      if (prev && rec.at.getTime() - prev.created_at.getTime() < VOTE_WINDOW_MS) {
        await client.query("ROLLBACK");
        return null;
      }
      await client.query(
        `INSERT INTO vote_events (user_id, reward, is_weekend, created_at)
         VALUES ($1, $2, $3, $4)`,
        [rec.userId, rec.reward, rec.isWeekend, rec.at],
      );
      await client.query("COMMIT");
      return rec;
    } catch (err) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw err;
    } finally {
      client.release();
    }
  }

  async lastVote(userId: string): Promise<VoteRecord | null> {
    const res = await this.pool.query<Row>(
      `SELECT user_id, reward::text AS reward, is_weekend, created_at
       FROM vote_events WHERE user_id = $1 ORDER BY created_at DESC LIMIT 1`,
      [userId],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async totals(userId: string): Promise<{ votes: number; earned: number }> {
    const res = await this.pool.query<{ votes: string; earned: string }>(
      `SELECT COUNT(*)::text AS votes, COALESCE(SUM(reward), 0)::text AS earned
       FROM vote_events WHERE user_id = $1`,
      [userId],
    );
    return {
      votes: Number.parseInt(res.rows[0]?.votes ?? "0", 10),
      earned: Number.parseInt(res.rows[0]?.earned ?? "0", 10),
    };
  }
}
