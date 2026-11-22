import type { Pool } from "pg";
import type {
  FormatKind,
  FormatRun,
  FormatRunState,
  FormatStore,
} from "../services/tcg-formats";

/** PostgreSQL FormatStore (spec 6.38, migration 0040). Claims ride
 *  the shared tcg_claims table so a reward claimed on Discord is
 *  already claimed on the web and vice versa. */
export class PgFormatStore implements FormatStore {
  constructor(private readonly pool: Pool) {}

  private mapRun(r: Record<string, unknown>): FormatRun {
    const state = (typeof r.state === "string" ? JSON.parse(r.state) : r.state) as FormatRunState;
    return {
      id: Number(r.id),
      userId: r.user_id as string,
      format: r.format as FormatKind,
      state,
      status: r.status as FormatRun["status"],
      paid: Boolean(r.paid),
      createdAt: new Date(r.created_at as string),
      expiresAt: new Date(r.expires_at as string),
    };
  }

  async activeRun(userId: string, format: FormatKind): Promise<FormatRun | null> {
    const res = await this.pool.query(
      `SELECT id, user_id, format, state, status, paid, created_at, expires_at
       FROM tcg_format_runs
       WHERE user_id = $1 AND format = $2 AND status <> 'done'
       ORDER BY id DESC LIMIT 1`,
      [userId, format],
    );
    return res.rows[0] ? this.mapRun(res.rows[0]) : null;
  }

  async createRun(
    userId: string,
    format: FormatKind,
    state: FormatRunState,
    paid: boolean,
  ): Promise<FormatRun> {
    const status = state.phase === "draft" ? "building" : state.phase === "fight" ? "fighting" : "done";
    const res = await this.pool.query(
      `INSERT INTO tcg_format_runs (user_id, format, state, status, paid)
       VALUES ($1, $2, $3::jsonb, $4, $5)
       RETURNING id, user_id, format, state, status, paid, created_at, expires_at`,
      [userId, format, JSON.stringify(state), status, paid],
    );
    return this.mapRun(res.rows[0]);
  }

  async saveRun(run: FormatRun): Promise<void> {
    await this.pool.query(
      `UPDATE tcg_format_runs SET state = $2::jsonb, status = $3, updated_at = now() WHERE id = $1`,
      [run.id, JSON.stringify(run.state), run.status],
    );
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
