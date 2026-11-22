import type { Pool } from "pg";
import type { QuestProgress, QuestStore } from "../services/tcg-quests";

/** PostgreSQL QuestStore (spec 6.38, migration 0040). The bonus
 *  claim rides the shared tcg_claims table like every other
 *  once-per-period reward. */
export class PgQuestStore implements QuestStore {
  constructor(private readonly pool: Pool) {}

  async getProgress(userId: string, day: string): Promise<QuestProgress[]> {
    const res = await this.pool.query(
      `SELECT quest_id, progress, claimed FROM tcg_quest_progress
       WHERE user_id = $1 AND day = $2`,
      [userId, day],
    );
    return res.rows.map((r) => ({
      questId: r.quest_id as string,
      progress: Number(r.progress),
      claimed: Boolean(r.claimed),
    }));
  }

  async bump(userId: string, day: string, questId: string, target: number, n: number): Promise<void> {
    await this.pool.query(
      `INSERT INTO tcg_quest_progress (user_id, day, quest_id, progress)
       VALUES ($1, $2, $3, LEAST($4::int, $5::int))
       ON CONFLICT (user_id, day, quest_id) DO UPDATE
         SET progress = LEAST($4::int, tcg_quest_progress.progress + $5::int)`,
      [userId, day, questId, target, n],
    );
  }

  async markClaimed(userId: string, day: string, questId: string): Promise<boolean> {
    const res = await this.pool.query(
      `UPDATE tcg_quest_progress SET claimed = true
       WHERE user_id = $1 AND day = $2 AND quest_id = $3 AND claimed = false`,
      [userId, day, questId],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async claimOnce(userId: string, kind: string, period: string): Promise<boolean> {
    const res = await this.pool.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
      [userId, kind, period],
    );
    return (res.rowCount ?? 0) > 0;
  }

  async hasClaimed(userId: string, kind: string, period: string): Promise<boolean> {
    const res = await this.pool.query(
      `SELECT 1 FROM tcg_claims WHERE user_id = $1 AND kind = $2 AND period = $3`,
      [userId, kind, period],
    );
    return (res.rowCount ?? 0) > 0;
  }
}
