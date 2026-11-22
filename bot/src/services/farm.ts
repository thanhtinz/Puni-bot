/**
 * Farm config (spec 6.21) — owner-tuned in Admin → Nông trại, stored
 * in bot_config 'farm_config', read live. Crop data lives in the
 * game_crops table (Admin-managed). Farm gameplay (planting on
 * per-player plots) ships with the game stage; this config is the
 * management surface that takes effect now.
 */
export interface FarmConfig {
  enabled: boolean;
  defaultPlots: number;
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

/** Plots a player gets: base + member bonus while membership is active. */
export function plotsFor(cfg: FarmConfig, isMember: boolean): number {
  return cfg.defaultPlots + (isMember ? cfg.memberExtraPlots : 0);
}
