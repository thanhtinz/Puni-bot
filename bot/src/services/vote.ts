/**
 * Vote rewards via top.gg (spec 6.22). Users vote for the bot on
 * top.gg (once per 12 hours); top.gg calls our webhook, the web
 * credits the reward into the global economy. Weekend votes count
 * double on top.gg, and members from the second tier up earn double
 * — both multipliers are owner-tunable in Admin → Vote.
 */
export interface VoteConfig {
  enabled: boolean;
  /** Base Coins per vote. */
  rewardPerVote: number;
  /** Multiplier applied when top.gg flags the vote as weekend. */
  weekendMultiplier: number;
  /** Multiplier for members at tier index >= 1 (spec 6.19 tie-in). */
  memberMultiplier: number;
  /** Public vote page; empty = derive from the bot id. */
  voteUrl: string;
}

export const DEFAULT_VOTE_CONFIG: VoteConfig = {
  enabled: true,
  rewardPerVote: 100,
  weekendMultiplier: 2,
  memberMultiplier: 2,
  voteUrl: "",
};

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? Math.trunc(v) : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizeVoteConfig(raw: unknown): VoteConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_VOTE_CONFIG };
  const r = raw as Partial<VoteConfig>;
  return {
    enabled: r.enabled !== false,
    rewardPerVote: clampInt(r.rewardPerVote, 0, 1_000_000, DEFAULT_VOTE_CONFIG.rewardPerVote),
    weekendMultiplier: clampInt(r.weekendMultiplier, 1, 10, DEFAULT_VOTE_CONFIG.weekendMultiplier),
    memberMultiplier: clampInt(r.memberMultiplier, 1, 10, DEFAULT_VOTE_CONFIG.memberMultiplier),
    voteUrl:
      typeof r.voteUrl === "string" && /^https:\/\//.test(r.voteUrl)
        ? r.voteUrl.slice(0, 200)
        : "",
  };
}

/** Final reward for one accepted vote. */
export function computeVoteReward(
  cfg: VoteConfig,
  opts: { isWeekend: boolean; isQualifiedMember: boolean },
): number {
  let amount = cfg.rewardPerVote;
  if (opts.isWeekend) amount *= cfg.weekendMultiplier;
  if (opts.isQualifiedMember) amount *= cfg.memberMultiplier;
  return amount;
}

/** top.gg allows one vote per user per 12 hours; a webhook arriving
 *  inside the window after an accepted vote is a retry/duplicate. */
export const VOTE_WINDOW_MS = 12 * 3600 * 1000;

export interface VoteRecord {
  userId: string;
  reward: number;
  isWeekend: boolean;
  at: Date;
}

export interface VoteStore {
  /** Records a vote unless one was accepted inside the window.
   *  Returns the record, or null when it is a duplicate. */
  record(rec: VoteRecord): Promise<VoteRecord | null>;
  lastVote(userId: string): Promise<VoteRecord | null>;
  totals(userId: string): Promise<{ votes: number; earned: number }>;
}

export class InMemoryVoteStore implements VoteStore {
  private readonly records: VoteRecord[] = [];

  async record(rec: VoteRecord): Promise<VoteRecord | null> {
    const last = await this.lastVote(rec.userId);
    if (last && rec.at.getTime() - last.at.getTime() < VOTE_WINDOW_MS) return null;
    this.records.push(rec);
    return rec;
  }

  async lastVote(userId: string): Promise<VoteRecord | null> {
    let best: VoteRecord | null = null;
    for (const r of this.records) {
      if (r.userId === userId && (!best || r.at > best.at)) best = r;
    }
    return best;
  }

  async totals(userId: string): Promise<{ votes: number; earned: number }> {
    const mine = this.records.filter((r) => r.userId === userId);
    return { votes: mine.length, earned: mine.reduce((s, r) => s + r.reward, 0) };
  }
}
