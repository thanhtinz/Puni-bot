/**
 * The gameplay side of daily quests (spec 6.38): bumpQuest advances
 * today's quests watching one action. It is fail-open by design —
 * quest progress must never break the action that triggered it.
 * Kept separate from lib/quests.ts so gameplay libs (gacha, battle,
 * formats, player, auction, shop) can import it without cycles.
 */
import { db } from "./db";
import { dailyQuests, utcDay } from "./quest-defs";

export async function bumpQuest(userId: string, action: string, n = 1): Promise<void> {
  try {
    const day = utcDay(new Date());
    for (const q of dailyQuests(day)) {
      if (q.action !== action) continue;
      await db().query(
        `INSERT INTO tcg_quest_progress (user_id, day, quest_id, progress)
         VALUES ($1, $2, $3, LEAST($4::int, $5::int))
         ON CONFLICT (user_id, day, quest_id) DO UPDATE
           SET progress = LEAST($4::int, tcg_quest_progress.progress + $5::int)`,
        [userId, day, q.id, q.target, n],
      );
    }
  } catch {
    /* fail-open */
  }
}
