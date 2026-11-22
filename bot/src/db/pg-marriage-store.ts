import type { Pool } from "pg";
import { PROPOSAL_TTL_MS, type Marriage, type MarriageStore, type Proposal } from "../services/marriage";

/** PostgreSQL MarriageStore (spec 6.16.5, migration 0021). */
export class PgMarriageStore implements MarriageStore {
  constructor(private readonly pool: Pool) {}

  async getMarriage(userId: string): Promise<Marriage | null> {
    const res = await this.pool.query(
      `SELECT user_a, user_b, ring_tier, married_at FROM marriages
       WHERE user_a = $1 OR user_b = $1 LIMIT 1`, [userId],
    );
    const r = res.rows[0];
    if (!r) return null;
    return {
      partnerId: r.user_a === userId ? r.user_b : r.user_a,
      ringTier: r.ring_tier,
      marriedAt: new Date(r.married_at),
    };
  }

  async createMarriage(a: string, b: string, ringTier: number): Promise<void> {
    const [x, y] = a < b ? [a, b] : [b, a];
    await this.pool.query(
      `INSERT INTO marriages (user_a, user_b, ring_tier) VALUES ($1, $2, $3)`,
      [x, y, ringTier],
    );
  }

  async setRingTier(a: string, b: string, ringTier: number): Promise<void> {
    const [x, y] = a < b ? [a, b] : [b, a];
    await this.pool.query(
      `UPDATE marriages SET ring_tier = $3 WHERE user_a = $1 AND user_b = $2`,
      [x, y, ringTier],
    );
  }

  async deleteMarriage(userId: string): Promise<void> {
    await this.pool.query(
      `DELETE FROM marriages WHERE user_a = $1 OR user_b = $1`, [userId],
    );
  }

  async ringQty(userId: string, tier: number): Promise<number> {
    const res = await this.pool.query(
      `SELECT qty FROM marriage_rings WHERE user_id = $1 AND tier = $2`, [userId, tier],
    );
    return res.rows[0]?.qty ?? 0;
  }

  async adjustRing(userId: string, tier: number, delta: number): Promise<number> {
    const res = await this.pool.query(
      `INSERT INTO marriage_rings (user_id, tier, qty) VALUES ($1, $2, GREATEST(0, $3))
       ON CONFLICT (user_id, tier) DO UPDATE SET qty = GREATEST(0, marriage_rings.qty + $3)
       RETURNING qty`,
      [userId, tier, delta],
    );
    return res.rows[0]?.qty ?? 0;
  }

  async createProposal(fromUser: string, toUser: string, ringTier: number, now: Date): Promise<Proposal> {
    const expires = new Date(now.getTime() + PROPOSAL_TTL_MS);
    const res = await this.pool.query(
      `INSERT INTO marriage_proposals (from_user, to_user, ring_tier, expires_at)
       VALUES ($1, $2, $3, $4) RETURNING id::text AS id, created_at, expires_at`,
      [fromUser, toUser, ringTier, expires],
    );
    const r = res.rows[0];
    return {
      id: Number.parseInt(r.id, 10), fromUser, toUser, ringTier,
      status: "pending", createdAt: new Date(r.created_at), expiresAt: new Date(r.expires_at),
    };
  }

  private rowToProposal(r: Record<string, unknown>): Proposal {
    return {
      id: Number.parseInt(String(r.id), 10),
      fromUser: String(r.from_user),
      toUser: String(r.to_user),
      ringTier: Number(r.ring_tier),
      status: r.status as Proposal["status"],
      createdAt: new Date(String(r.created_at)),
      expiresAt: new Date(String(r.expires_at)),
    };
  }

  async pendingProposalFor(toUser: string): Promise<Proposal | null> {
    const res = await this.pool.query(
      `SELECT id::text AS id, from_user, to_user, ring_tier, status, created_at, expires_at
       FROM marriage_proposals WHERE to_user = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`, [toUser],
    );
    return res.rows[0] ? this.rowToProposal(res.rows[0]) : null;
  }

  async pendingProposalFrom(fromUser: string): Promise<Proposal | null> {
    const res = await this.pool.query(
      `SELECT id::text AS id, from_user, to_user, ring_tier, status, created_at, expires_at
       FROM marriage_proposals WHERE from_user = $1 AND status = 'pending'
       ORDER BY created_at DESC LIMIT 1`, [fromUser],
    );
    return res.rows[0] ? this.rowToProposal(res.rows[0]) : null;
  }

  async resolveProposal(id: number, status: Proposal["status"]): Promise<void> {
    await this.pool.query(
      `UPDATE marriage_proposals SET status = $2 WHERE id = $1 AND status = 'pending'`,
      [id, status],
    );
  }

  async recordCoupleDaily(userId: string, partnerId: string, day: string): Promise<boolean> {
    const client = await this.pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(
        `INSERT INTO couple_daily (user_id, day) VALUES ($1, $2)
         ON CONFLICT (user_id, day) DO NOTHING`, [userId, day],
      );
      const res = await client.query(
        `SELECT user_id, gifted FROM couple_daily WHERE day = $1 AND user_id = ANY($2)`,
        [day, [userId, partnerId]],
      );
      const both = res.rows.length === 2;
      const gifted = res.rows.some((r) => r.gifted);
      await client.query("COMMIT");
      return both && !gifted;
    } catch (e) {
      await client.query("ROLLBACK").catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  }

  async markCoupleGifted(userId: string, partnerId: string, day: string): Promise<void> {
    await this.pool.query(
      `UPDATE couple_daily SET gifted = true WHERE day = $1 AND user_id = ANY($2)`,
      [day, [userId, partnerId]],
    );
  }
}
