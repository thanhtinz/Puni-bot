/**
 * Daily TCG quest definitions + the deterministic daily selection
 * (spec 6.38). Pure module — no imports — so every gameplay lib can
 * hook progress without import cycles. Mirrors the bot's
 * services/tcg-quests.ts; ids, targets and rewards are the contract.
 * The seeded helpers are verbatim copies of lib/formats.ts.
 */

export function hashSeed(text: string): number {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function rngFromSeed(seed: number): () => number {
  let a = (seed >>> 0) || 1;
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const utcDay = (d: Date): string => d.toISOString().slice(0, 10);

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
