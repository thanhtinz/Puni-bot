/**
 * Fishing (spec 6.20) — v1 mini-loop: cast → rarity roll → the catch
 * auto-sells for Coins inside the rarity's price range. Every number
 * (weights, ranges, cooldown, daily cap) is owner-edited in the Admin
 * panel (bot_config 'fishing_config'); the defaults below are only the
 * starting point. A per-user daily cap from the economy ledger keeps
 * the faucet bounded.
 */

export type FishRarity = "common" | "uncommon" | "rare" | "epic" | "legendary";

export const FISH_RARITIES: FishRarity[] = [
  "common",
  "uncommon",
  "rare",
  "epic",
  "legendary",
];

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
  /** Roll weights per rarity (relative, need not sum to 100). */
  weights: Record<FishRarity, number>;
  /** Auto-sell price range per rarity, in Coins. */
  priceMin: Record<FishRarity, number>;
  priceMax: Record<FishRarity, number>;
  /** Max Coins one user can earn from fishing per day (0 = no cap). */
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
  if (!raw || typeof raw !== "object") {
    return structuredClone(DEFAULT_FISHING_CONFIG);
  }
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
    out.priceMax[k] = Math.max(
      out.priceMin[k],
      num(pMax[k], 0, 1_000_000_000, DEFAULT_FISHING_CONFIG.priceMax[k]),
    );
  }
  if (FISH_RARITIES.every((k) => out.weights[k] <= 0)) {
    out.weights = { ...DEFAULT_FISHING_CONFIG.weights };
  }
  return out;
}

/** Weighted rarity roll. `rng` returns [0, 1). */
export function rollFishRarity(cfg: FishingConfig, rng: () => number): FishRarity {
  const total = FISH_RARITIES.reduce((s, k) => s + Math.max(0, cfg.weights[k]), 0);
  let x = rng() * total;
  for (const k of FISH_RARITIES) {
    x -= Math.max(0, cfg.weights[k]);
    if (x < 0) return k;
  }
  return "common";
}

/** Uniform integer price inside the rarity range (inclusive). */
export function rollFishPrice(cfg: FishingConfig, rarity: FishRarity, rng: () => number): number {
  const min = cfg.priceMin[rarity];
  const max = cfg.priceMax[rarity];
  return min + Math.floor(rng() * (max - min + 1));
}

export type FishOutcome =
  | { kind: "disabled" }
  | { kind: "cooldown"; waitSec: number }
  | {
      kind: "caught";
      rarity: FishRarity;
      price: number;
      /** Coins actually credited (0 when the daily cap was reached). */
      credited: number;
      capped: boolean;
    };

export class FishingService {
  private lastCast = new Map<string, number>();

  constructor(
    private deps: {
      configSource: () => Promise<FishingConfig>;
      /** Coins this user already earned from fishing today (ledger). */
      earnedToday: (userId: string) => Promise<number>;
      credit: (userId: string, amount: number, note: string) => Promise<void>;
      /** Membership boost (spec 6.19): members fish with a halved
       *  cooldown and a doubled daily cap. */
      memberBoost?: (userId: string) => Promise<{ cooldownFactor: number; capFactor: number }>;
      rng?: () => number;
      now?: () => number;
    },
  ) {}

  async cast(userId: string): Promise<FishOutcome> {
    const cfg = await this.deps.configSource();
    if (!cfg.enabled) return { kind: "disabled" };
    const boost = this.deps.memberBoost
      ? await this.deps.memberBoost(userId).catch(() => ({ cooldownFactor: 1, capFactor: 1 }))
      : { cooldownFactor: 1, capFactor: 1 };
    const cooldownSec = Math.floor(cfg.cooldownSec * boost.cooldownFactor);
    const dailyCap = cfg.dailyCap > 0 ? Math.floor(cfg.dailyCap * boost.capFactor) : 0;
    const now = this.deps.now ? this.deps.now() : Date.now();
    const last = this.lastCast.get(userId) ?? 0;
    const waitMs = last + cooldownSec * 1000 - now;
    if (cooldownSec > 0 && waitMs > 0) {
      return { kind: "cooldown", waitSec: Math.ceil(waitMs / 1000) };
    }
    this.lastCast.set(userId, now);
    const rng = this.deps.rng ?? Math.random;
    const rarity = rollFishRarity(cfg, rng);
    const price = rollFishPrice(cfg, rarity, rng);
    let credited = price;
    let capped = false;
    if (dailyCap > 0) {
      const earned = await this.deps.earnedToday(userId).catch(() => 0);
      const room = Math.max(0, dailyCap - earned);
      credited = Math.min(price, room);
      capped = credited < price;
    }
    if (credited > 0) {
      await this.deps.credit(userId, credited, `Câu cá: ${FISH_RARITY_LABELS[rarity]}`);
    }
    return { kind: "caught", rarity, price, credited, capped };
  }
}
