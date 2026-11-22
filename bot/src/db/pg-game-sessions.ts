import type { Pool } from "pg";
import type { GameSessionStore } from "../services/game-sessions";

/** PostgreSQL GameSessionStore (migration 0022). */
export class PgGameSessionStore implements GameSessionStore {
  constructor(private readonly pool: Pool) {}

  async get(userId: string, game: string): Promise<Record<string, unknown> | null> {
    const res = await this.pool.query(
      `SELECT state FROM game_sessions WHERE user_id = $1 AND game = $2`,
      [userId, game],
    );
    return (res.rows[0]?.state as Record<string, unknown>) ?? null;
  }

  async set(userId: string, game: string, state: Record<string, unknown>): Promise<void> {
    await this.pool.query(
      `INSERT INTO game_sessions (user_id, game, state, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (user_id, game) DO UPDATE SET state = EXCLUDED.state, updated_at = now()`,
      [userId, game, JSON.stringify(state)],
    );
  }

  async delete(userId: string, game: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM game_sessions WHERE user_id = $1 AND game = $2`,
      [userId, game],
    );
  }
}
