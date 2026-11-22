/**
 * Mirror of the bot's fishing config contract (spec 6.20). Stored in
 * bot_config 'fishing_config', edited in Admin → Câu cá; the bot
 * normalizes again on read.
 */
export type FishRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const FISH_RARITIES: FishRarity[] = ["common", "uncommon", "rare", "epic", "legendary"];

export const FISH_RARITY_LABELS: Record<FishRarity, string> = {
  common: "Thường",
  uncommon: "Ít gặp",
  rare: "Hiếm",
  epic: "Sử thi",
  legendary: "Huyền thoại",
};

export interface FishingConfig {
  enabled: boolean;
  cooldownSec: number;
  weights: Record<FishRarity, number>;
  priceMin: Record<FishRarity, number>;
  priceMax: Record<FishRarity, number>;
  dailyCap: number;
}

export const DEFAULT_FISHING_CONFIG: FishingConfig = {
  enabled: true,
  cooldownSec: 60,
  weights: { common: 60, uncommon: 25, rare: 10, epic: 4, legendary: 1 },
  priceMin: { common: 5, uncommon: 20, rare: 60, epic: 150, legendary: 400 },
  priceMax: { common: 15, uncommon: 50, rare: 120, epic: 300, legendary: 800 },
  dailyCap: 2000,
};

function num(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? v : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(Math.floor(n), min), max);
}

export function normalizeFishingConfig(raw: unknown): FishingConfig {
  if (!raw || typeof raw !== "object") return structuredClone(DEFAULT_FISHING_CONFIG);
  const r = raw as Record<string, unknown>;
  const rec = (v: unknown): Record<string, unknown> =>
    v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  const w = rec(r.weights);
  const pMin = rec(r.priceMin);
  const pMax = rec(r.priceMax);
  const out: FishingConfig = {
    enabled: r.enabled !== false,
    cooldownSec: num(r.cooldownSec, 0, 3600, DEFAULT_FISHING_CONFIG.cooldownSec),
    weights: {} as Record<FishRarity, number>,
    priceMin: {} as Record<FishRarity, number>,
    priceMax: {} as Record<FishRarity, number>,
    dailyCap: num(r.dailyCap, 0, 1_000_000_000, DEFAULT_FISHING_CONFIG.dailyCap),
  };
  for (const k of FISH_RARITIES) {
    out.weights[k] = num(w[k], 0, 100_000, DEFAULT_FISHING_CONFIG.weights[k]);
    out.priceMin[k] = num(pMin[k], 0, 1_000_000_000, DEFAULT_FISHING_CONFIG.priceMin[k]);
    out.priceMax[k] = Math.max(out.priceMin[k], num(pMax[k], 0, 1_000_000_000, DEFAULT_FISHING_CONFIG.priceMax[k]));
  }
  if (FISH_RARITIES.every((k) => out.weights[k] <= 0)) {
    out.weights = { ...DEFAULT_FISHING_CONFIG.weights };
  }
  return out;
}
