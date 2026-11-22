/** Farm config (mirror of bot/src/services/farm.ts). */
export interface FarmConfig {
  enabled: boolean;
  /** Garden plots every player starts with. */
  defaultPlots: number;
  /** Extra plots for active members (spec 6.19). */
  memberExtraPlots: number;
}

export const DEFAULT_FARM_CONFIG: FarmConfig = {
  enabled: true,
  defaultPlots: 6,
  memberExtraPlots: 3,
};

const clamp = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? Math.trunc(v) : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizeFarmConfig(raw: unknown): FarmConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_FARM_CONFIG };
  const r = raw as Partial<FarmConfig>;
  return {
    enabled: r.enabled !== false,
    defaultPlots: clamp(r.defaultPlots, 1, 60, DEFAULT_FARM_CONFIG.defaultPlots),
    memberExtraPlots: clamp(r.memberExtraPlots, 0, 60, DEFAULT_FARM_CONFIG.memberExtraPlots),
  };
}
