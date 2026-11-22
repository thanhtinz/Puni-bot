/**
 * Daily TCG quests (spec 6.38): five quests per UTC day, the same
 * set for everyone, picked deterministically from a pool of ten by
 * the day seed (the dashboard mirrors the selection). Progress is
 * bumped by gameplay hooks (pulls, battles, enhances, market
 * actions...) and NEVER blocks the action that triggered it — every
 * hook call is fail-open. Rewards claim per quest; claiming all
 * five pays a completion bonus once per day (tcg_claims kind
 * 'questbonus'). Quest definitions live here and are mirrored in
 * dashboard/src/lib/quests.ts — the ids and numbers are the
 * contract.
 */
import type { TcgEconomyHooks, TcgStore } from "./tcg-store";
import { hashSeed, rngFromSeed, utcDay } from "./tcg-formats";

export interface QuestDef {
  id: string;
  name: string;
  action: string;
  target: number;
  coins: number;
  shards: number;
}

export const QUEST_POOL: QuestDef[] = [
  { id: "pull10", name: "Mở 10 lá thẻ", action: "pull", target: 10, coins: 120, shards: 0 },
  { id: "win2", name: "Thắng 2 trận đấu thẻ", action: "battle_win", target: 2, coins: 150, shards: 0 },
  { id: "play4", name: "Đấu 4 trận bất kỳ", action: "battle_play", target: 4, coins: 100, shards: 0 },
  { id: "enhance2", name: "Cường hoá thẻ 2 lần", action: "enhance", target: 2, coins: 0, shards: 8 },
  { id: "sell1", name: "Bán 1 lá trên chợ", action: "sell", target: 1, coins: 100, shards: 0 },
  { id: "buy2", name: "Mua 2 lá ở chợ hoặc shop", action: "buy", target: 2, coins: 100, shards: 0 },
  { id: "evolve1", name: "Tiến hoá 1 lá thẻ", action: "evolve", target: 1, coins: 0, shards: 12 },
  { id: "deck1", name: "Dựng 1 bộ bài hợp lệ", action: "deck_build", target: 1, coins: 80, shards: 0 },
  { id: "bid1", name: "Đặt giá ở 1 phiên đấu giá", action: "auction_bid", target: 1, coins: 60, shards: 0 },
  { id: "chal1", name: "Thắng thử thách ngày", action: "challenge_win", target: 1, coins: 150, shards: 0 },
];

export const QUESTS_PER_DAY = 5;
export const QUEST_BONUS_COINS = 300;
export const QUEST_BONUS_SHARDS = 10;

/** Today's five quests — deterministic, identical on every surface. */
export function dailyQuests(day: string): QuestDef[] {
  const rng = rngFromSeed(hashSeed(`quests:${day}`));
  const idx = QUEST_POOL.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, QUESTS_PER_DAY).map((i) => QUEST_POOL[i]!);
}

export interface QuestProgress {
  questId: string;
  progress: number;
  claimed: boolean;
}

export interface QuestStore {
  getProgress(userId: string, day: string): Promise<QuestProgress[]>;
  bump(userId: string, day: string, questId: string, target: number, n: number): Promise<void>;
  markClaimed(userId: string, day: string, questId: string): Promise<boolean>;
  claimOnce(userId: string, kind: string, period: string): Promise<boolean>;
  hasClaimed(userId: string, kind: string, period: string): Promise<boolean>;
}

export class InMemoryQuestStore implements QuestStore {
  private rows = new Map<string, QuestProgress>();
  private claims = new Set<string>();
  private key(userId: string, day: string, questId: string): string {
    return `${userId}|${day}|${questId}`;
  }

  async getProgress(userId: string, day: string): Promise<QuestProgress[]> {
    return [...this.rows.entries()]
      .filter(([k]) => k.startsWith(`${userId}|${day}|`))
      .map(([, v]) => v);
  }

  async bump(userId: string, day: string, questId: string, target: number, n: number): Promise<void> {
    const k = this.key(userId, day, questId);
    const row = this.rows.get(k) ?? { questId, progress: 0, claimed: false };
    row.progress = Math.min(target, row.progress + n);
    this.rows.set(k, row);
  }

  async markClaimed(userId: string, day: string, questId: string): Promise<boolean> {
    const row = this.rows.get(this.key(userId, day, questId));
    if (!row || row.claimed) return false;
    row.claimed = true;
    return true;
  }

  async claimOnce(userId: string, kind: string, period: string): Promise<boolean> {
    const key = `${userId}|${kind}|${period}`;
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }

  async hasClaimed(userId: string, kind: string, period: string): Promise<boolean> {
    return this.claims.has(`${userId}|${kind}|${period}`);
  }
}

export interface QuestViewRow extends QuestDef {
  progress: number;
  claimed: boolean;
  done: boolean;
}

export class TcgQuestsGame {
  constructor(
    private readonly deps: {
      store: TcgStore;
      quests: QuestStore;
      economy: TcgEconomyHooks;
      now?: () => Date;
    },
  ) {}

  private day(): string {
    return utcDay(this.deps.now ? this.deps.now() : new Date());
  }

  /** Gameplay hook — bumps every daily quest watching this action. */
  async bump(userId: string, action: string, n = 1): Promise<void> {
    const day = this.day();
    for (const q of dailyQuests(day)) {
      if (q.action === action) {
        await this.deps.quests.bump(userId, day, q.id, q.target, n);
      }
    }
  }

  async view(userId: string): Promise<{ day: string; rows: QuestViewRow[]; bonusClaimed: boolean }> {
    const day = this.day();
    const progress = await this.deps.quests.getProgress(userId, day);
    const byId = new Map(progress.map((p) => [p.questId, p]));
    const rows = dailyQuests(day).map((q) => {
      const p = byId.get(q.id);
      return {
        ...q,
        progress: p?.progress ?? 0,
        claimed: p?.claimed ?? false,
        done: (p?.progress ?? 0) >= q.target,
      };
    });
    const bonusClaimed = await this.deps.quests.hasClaimed(userId, "questbonus", day);
    return { day, rows, bonusClaimed };
  }

  /** Claim one finished quest; pays the all-five bonus when due. */
  async claim(
    userId: string,
    questId: string,
  ): Promise<
    | { kind: "ok"; coins: number; shards: number; bonusCoins: number; bonusShards: number }
    | { kind: "error"; message: string }
  > {
    const day = this.day();
    const def = dailyQuests(day).find((q) => q.id === questId);
    if (!def) return { kind: "error", message: "Nhiệm vụ không thuộc danh sách hôm nay." };
    const progress = await this.deps.quests.getProgress(userId, day);
    const row = progress.find((p) => p.questId === questId);
    if (!row || row.progress < def.target) {
      return { kind: "error", message: `Chưa xong nhiệm vụ "${def.name}" (${row?.progress ?? 0}/${def.target}).` };
    }
    if (row.claimed) return { kind: "error", message: "Nhiệm vụ này đã nhận thưởng rồi." };
    const marked = await this.deps.quests.markClaimed(userId, day, questId);
    if (!marked) return { kind: "error", message: "Nhiệm vụ này đã nhận thưởng rồi." };
    if (def.coins > 0) await this.deps.economy.credit(userId, def.coins, "tcg-quest", `Nhiệm vụ: ${def.name}`);
    if (def.shards > 0) await this.deps.store.adjustWallet(userId, { shards: def.shards });
    let bonusCoins = 0;
    let bonusShards = 0;
    const after = await this.deps.quests.getProgress(userId, day);
    const allClaimed = dailyQuests(day).every((q) => {
      const p = after.find((x) => x.questId === q.id);
      return p?.claimed && p.progress >= q.target;
    });
    if (allClaimed) {
      const first = await this.deps.quests.claimOnce(userId, "questbonus", day);
      if (first) {
        bonusCoins = QUEST_BONUS_COINS;
        bonusShards = QUEST_BONUS_SHARDS;
        await this.deps.economy.credit(userId, bonusCoins, "tcg-quest", "Thưởng hoàn thành 5 nhiệm vụ ngày");
        await this.deps.store.adjustWallet(userId, { shards: bonusShards });
      }
    }
    return { kind: "ok", coins: def.coins, shards: def.shards, bonusCoins, bonusShards };
  }
}
