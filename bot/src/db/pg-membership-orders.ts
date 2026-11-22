import type { Pool } from "pg";
import type { MembershipOrder, MembershipOrderStore } from "../services/membership";

interface Row {
  code: string;
  user_id: string;
  tier_id: string;
  tier_name: string;
  amount: string;
  days: number;
  status: string;
  created_at: Date;
  paid_at: Date | null;
}

/** Read-only order history for the bot's `orders` command (spec 6.19).
 *  Orders are created and confirmed on the dashboard side. */
export class PgMembershipOrderStore implements MembershipOrderStore {
  constructor(private pool: Pool) {}

  async listByUser(userId: string, limit: number): Promise<MembershipOrder[]> {
    const res = await this.pool.query<Row>(
      `SELECT code, user_id, tier_id, tier_name, amount::text AS amount, days, status, created_at, paid_at
       FROM membership_orders WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
      [userId, limit],
    );
    return res.rows.map((r) => ({
      code: r.code,
      userId: r.user_id,
      tierId: r.tier_id,
      tierName: r.tier_name,
      amount: Number.parseInt(r.amount, 10),
      days: r.days,
      status: r.status === "paid" ? "paid" : r.status === "cancelled" ? "cancelled" : "pending",
      createdAt: new Date(r.created_at),
      paidAt: r.paid_at ? new Date(r.paid_at) : null,
    }));
  }
}
