/**
 * Ranked ladder math for TCG battles (spec 6.26): hidden MMR with an
 * Elo expectation curve, display tiers derived from MMR, 30-day-ish
 * seasons keyed by calendar month with a soft reset toward 1000.
 * Pure functions — storage lives in the TCG store.
 */

export interface RankTier {
  id: string;
  name: string;
  minMmr: number;
}

export const RANK_TIERS: RankTier[] = [
  { id: "dong", name: "Đồng", minMmr: 0 },
  { id: "bac", name: "Bạc", minMmr: 1100 },
  { id: "vang", name: "Vàng", minMmr: 1250 },
  { id: "bach-kim", name: "Bạch Kim", minMmr: 1450 },
  { id: "kim-cuong", name: "Kim Cương", minMmr: 1700 },
  { id: "cao-thu", name: "Cao Thủ", minMmr: 2000 },
];

export const RANKED_START_MMR = 1000;
export const RANKED_K = 32;

export function rankTierFor(mmr: number): RankTier {
  let cur = RANK_TIERS[0];
  for (const t of RANK_TIERS) if (mmr >= t.minMmr) cur = t;
  return cur;
}

export function nextTierFor(mmr: number): RankTier | null {
  for (const t of RANK_TIERS) if (mmr < t.minMmr) return t;
  return null;
}

/** Zero-sum Elo delta applied +delta to the winner, -delta to the loser. */
export function eloDelta(winnerMmr: number, loserMmr: number, k = RANKED_K): number {
  const expected = 1 / (1 + Math.pow(10, (loserMmr - winnerMmr) / 400));
  return Math.max(1, Math.round(k * (1 - expected)));
}

/** Season key = calendar month (UTC), e.g. "2026-11". */
export function seasonKey(at: Date): string {
  return at.toISOString().slice(0, 7);
}

/** Soft reset: halfway back to the start MMR. */
export function softResetMmr(mmr: number): number {
  return RANKED_START_MMR + Math.round((mmr - RANKED_START_MMR) / 2);
}

export interface RankedProfile {
  userId: string;
  mmr: number;
  wins: number;
  losses: number;
  season: string;
  seasonWins: number;
  seasonLosses: number;
}

export function freshRankedProfile(userId: string, at: Date): RankedProfile {
  return {
    userId,
    mmr: RANKED_START_MMR,
    wins: 0,
    losses: 0,
    season: seasonKey(at),
    seasonWins: 0,
    seasonLosses: 0,
  };
}

/** Apply the season rollover to a stored profile (pure). */
export function rolloverProfile(p: RankedProfile, at: Date): RankedProfile {
  const s = seasonKey(at);
  if (p.season === s) return p;
  return {
    ...p,
    mmr: softResetMmr(p.mmr),
    season: s,
    seasonWins: 0,
    seasonLosses: 0,
  };
}

export type DuelStatus = "pending" | "done" | "rejected" | "expired";

export interface Duel {
  id: number;
  challengerId: string;
  opponentId: string;
  wager: number;
  status: DuelStatus;
  winnerId: string | null;
  createdAt: Date;
  resolvedAt: Date | null;
}

export const DUEL_TTL_MS = 5 * 60 * 1000;

export function duelExpired(d: Duel, at: Date): boolean {
  return d.status === "pending" && at.getTime() - d.createdAt.getTime() > DUEL_TTL_MS;
}
