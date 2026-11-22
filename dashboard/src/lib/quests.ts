/**
 * Web daily TCG quests (spec 6.38): view + claim side. Definitions
 * and the daily selection live in lib/quest-defs.ts; the gameplay
 * hook is lib/quest-hooks.ts. Claims pay inside one transaction.
 */
import { db } from "./db";
import { adjustBalanceTx } from "./player";
import {
  QUEST_BONUS_COINS,
  QUEST_BONUS_SHARDS,
  dailyQuests,
  utcDay,
  type QuestDef,
} from "./quest-defs";

export {
  QUEST_POOL,
  QUESTS_PER_DAY,
  QUEST_BONUS_COINS,
  QUEST_BONUS_SHARDS,
  dailyQuests,
} from "./quest-defs";
export type { QuestDef } from "./quest-defs";

export interface QuestViewRow extends QuestDef {
  progress: number;
  claimed: boolean;
  done: boolean;
}

export async function questView(
  userId: string,
): Promise<{ day: string; rows: QuestViewRow[]; bonusClaimed: boolean }> {
  const day = utcDay(new Date());
  const res = await db().query(
    `SELECT quest_id, progress, claimed FROM tcg_quest_progress WHERE user_id = $1 AND day = $2`,
    [userId, day],
  );
  const byId = new Map(
    (res.rows as unknown as Array<Record<string, unknown>>).map((r) => [
      String(r.quest_id),
      { progress: Number(r.progress), claimed: Boolean(r.claimed) },
    ]),
  );
  const rows = dailyQuests(day).map((q) => {
    const p = byId.get(q.id);
    return {
      ...q,
      progress: p?.progress ?? 0,
      claimed: p?.claimed ?? false,
      done: (p?.progress ?? 0) >= q.target,
    };
  });
  const bonus = await db().query(
    `SELECT 1 FROM tcg_claims WHERE user_id = $1 AND kind = 'questbonus' AND period = $2`,
    [userId, day],
  );
  return { day, rows, bonusClaimed: (bonus.rowCount ?? 0) > 0 };
}

type TxClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, never>[]; rowCount?: number | null }>;
};

export async function claimQuestWeb(
  userId: string,
  questId: string,
): Promise<
  | { ok: true; coins: number; shards: number; bonusCoins: number; bonusShards: number }
  | { ok: false; error: string }
> {
  const day = utcDay(new Date());
  const def = dailyQuests(day).find((q) => q.id === questId);
  if (!def) return { ok: false, error: "Nhiệm vụ không thuộc danh sách hôm nay." };
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `SELECT progress, claimed FROM tcg_quest_progress
       WHERE user_id = $1 AND day = $2 AND quest_id = $3 FOR UPDATE`,
      [userId, day, questId],
    );
    const row = (res.rows as unknown as Array<Record<string, unknown>>)[0];
    if (!row || Number(row.progress) < def.target) {
      await client.query("ROLLBACK");
      return { ok: false, error: `Chưa xong nhiệm vụ "${def.name}" (${Number(row?.progress ?? 0)}/${def.target}).` };
    }
    if (Boolean(row.claimed)) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Nhiệm vụ này đã nhận thưởng rồi." };
    }
    await client.query(
      `UPDATE tcg_quest_progress SET claimed = true WHERE user_id = $1 AND day = $2 AND quest_id = $3`,
      [userId, day, questId],
    );
    if (def.coins > 0) {
      await adjustBalanceTx(client as TxClient, userId, def.coins, "tcg-quest", `Nhiệm vụ: ${def.name} (web)`);
    }
    if (def.shards > 0) {
      await client.query(
        `INSERT INTO tcg_wallets (user_id, shards) VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE SET shards = tcg_wallets.shards + $2`,
        [userId, def.shards],
      );
    }
    let bonusCoins = 0;
    let bonusShards = 0;
    const all = await client.query(
      `SELECT quest_id, progress, claimed FROM tcg_quest_progress WHERE user_id = $1 AND day = $2`,
      [userId, day],
    );
    const byId = new Map(
      (all.rows as unknown as Array<Record<string, unknown>>).map((r) => [
        String(r.quest_id),
        { progress: Number(r.progress), claimed: Boolean(r.claimed) },
      ]),
    );
    const allClaimed = dailyQuests(day).every((q) => {
      const p = byId.get(q.id);
      return p?.claimed && p.progress >= q.target;
    });
    if (allClaimed) {
      const claim = await client.query(
        `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'questbonus', $2)
         ON CONFLICT DO NOTHING RETURNING user_id`,
        [userId, day],
      );
      if (claim.rows.length) {
        bonusCoins = QUEST_BONUS_COINS;
        bonusShards = QUEST_BONUS_SHARDS;
        await adjustBalanceTx(client as TxClient, userId, bonusCoins, "tcg-quest", "Thưởng hoàn thành 5 nhiệm vụ ngày (web)");
        await client.query(
          `INSERT INTO tcg_wallets (user_id, shards) VALUES ($1, $2)
           ON CONFLICT (user_id) DO UPDATE SET shards = tcg_wallets.shards + $2`,
          [userId, bonusShards],
        );
      }
    }
    await client.query("COMMIT");
    return { ok: true, coins: def.coins, shards: def.shards, bonusCoins, bonusShards };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi nhận thưởng, thử lại sau." };
  } finally {
    client.release();
  }
}
