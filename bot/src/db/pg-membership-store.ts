import type { Pool } from "pg";
import type { MembershipRecord, MembershipStore } from "../services/membership";

interface Row {
  user_id: string;
  tier_id: string;
  started_at: Date;
  expires_at: Date;
  source: string;
  note: string;
}

function toRecord(r: Row): MembershipRecord {
  return {
    userId: r.user_id,
    tierId: r.tier_id,
    startedAt: new Date(r.started_at),
    expiresAt: new Date(r.expires_at),
    source: r.source,
    note: r.note,
  };
}

/** PostgreSQL membership store (migration 0010). Grant/extend runs in
 *  one upsert so the stacking rule (from the later of now / current
 *  expiry) is atomic. */
export class PgMembershipStore implements MembershipStore {
  constructor(private pool: Pool) {}

  async getActive(userId: string, at: Date): Promise<MembershipRecord | null> {
    const res = await this.pool.query<Row>(
      `SELECT user_id, tier_id, started_at, expires_at, source, note
       FROM memberships WHERE user_id = $1 AND expires_at > $2`,
      [userId, at],
    );
    return res.rows[0] ? toRecord(res.rows[0]) : null;
  }

  async grant(input: {
    userId: string;
    tierId: string;
    days: number;
    source: string;
    note: string;
    at: Date;
  }): Promise<MembershipRecord> {
    const res = await this.pool.query<Row>(
      `INSERT INTO memberships (user_id, tier_id, started_at, expires_at, source, note, updated_at)
       VALUES ($1, $2, $6, $6 + ($3 || ' days')::interval, $4, $5, now())
       ON CONFLICT (user_id) DO UPDATE SET
         tier_id = EXCLUDED.tier_id,
         started_at = CASE WHEN memberships.tier_id = EXCLUDED.tier_id THEN memberships.started_at ELSE EXCLUDED.started_at END,
         expires_at = GREATEST(memberships.expires_at, EXCLUDED.started_at) + ($3 || ' days')::interval,
         source = EXCLUDED.source,
         note = EXCLUDED.note,
         updated_at = now()
       RETURNING user_id, tier_id, started_at, expires_at, source, note`,
      [input.userId, input.tierId, String(input.days), input.source, input.note, input.at],
    );
    return toRecord(res.rows[0]);
  }

  async revoke(userId: string): Promise<void> {
    await this.pool.query(`DELETE FROM memberships WHERE user_id = $1`, [userId]);
  }
}
