/** Vote config + reward math (mirror of bot/src/services/vote.ts). */
export interface VoteConfig {
  enabled: boolean;
  rewardPerVote: number;
  weekendMultiplier: number;
  memberMultiplier: number;
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

export function computeVoteReward(
  cfg: VoteConfig,
  opts: { isWeekend: boolean; isQualifiedMember: boolean },
): number {
  let amount = cfg.rewardPerVote;
  if (opts.isWeekend) amount *= cfg.weekendMultiplier;
  if (opts.isQualifiedMember) amount *= cfg.memberMultiplier;
  return amount;
}

export const VOTE_WINDOW_MS = 12 * 3600 * 1000;
