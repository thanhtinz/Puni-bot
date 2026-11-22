/**
 * TCG card game core (spec 6.23): gacha with per-banner pity,
 * card instances, decks, market, trades, achievements. Pure logic
 * + store interfaces; persistence lives in db/pg-tcg-store.ts and
 * the in-memory store below (tests, no-DB mode).
 */
export const TCG_RARITIES = [
  "Common",
  "Uncommon",
  "Rare",
  "Epic",
  "Legendary",
  "Mythical",
  "Fabled",
] as const;
export type TcgRarity = (typeof TCG_RARITIES)[number];

export const rarityRank = (r: string): number =>
  Math.max(0, TCG_RARITIES.indexOf(r as TcgRarity));

export interface TcgConfig {
  pullCostCoins: number;
  beginnerCostCoins: number;
  rates: Record<TcgRarity, number>;
  pityEpic: number;
  pityLegendary: number;
  exchangePoints: number;
  marketFeePercent: number;
  marketMinPrice: number;
  deckSize: number;
  deckMaxCopies: number;
  deckMinSpecies: number;
  maxDecks: number;
  beginnerMaxPulls: number;
  /** Percent of a card's own value paid when selling it to the system. */
  sellRatePercent: number;
  /** Coins per 1 USD of real market price (spec 6.29): a species with a
   * market price (game_species.price_usd) is valued price x this rate. */
  priceCoinsPerUsd: number;
}

export const DEFAULT_TCG_CONFIG: TcgConfig = {
  pullCostCoins: 500,
  beginnerCostCoins: 250,
  rates: { Common: 55, Uncommon: 25, Rare: 12, Epic: 5, Legendary: 2, Mythical: 0.7, Fabled: 0.3 },
  pityEpic: 30,
  pityLegendary: 90,
  exchangePoints: 100,
  sellRatePercent: 60,
  priceCoinsPerUsd: 1,
  marketFeePercent: 5,
  marketMinPrice: 10,
  deckSize: 30,
  deckMaxCopies: 3,
  deckMinSpecies: 10,
  maxDecks: 5,
  beginnerMaxPulls: 30,
};

const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export function normalizeTcgConfig(raw: unknown): TcgConfig {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_TCG_CONFIG, rates: { ...DEFAULT_TCG_CONFIG.rates } };
  const r = raw as Partial<TcgConfig> & { rates?: Partial<Record<TcgRarity, number>> };
  const rates = { ...DEFAULT_TCG_CONFIG.rates };
  for (const k of TCG_RARITIES) {
    if (r.rates && typeof r.rates[k] === "number") rates[k] = Math.max(0, r.rates[k]!);
  }
  return {
    pullCostCoins: clampNum(r.pullCostCoins, 0, 1_000_000, DEFAULT_TCG_CONFIG.pullCostCoins),
    beginnerCostCoins: clampNum(r.beginnerCostCoins, 0, 1_000_000, DEFAULT_TCG_CONFIG.beginnerCostCoins),
    rates,
    pityEpic: clampNum(r.pityEpic, 1, 1000, DEFAULT_TCG_CONFIG.pityEpic),
    pityLegendary: clampNum(r.pityLegendary, 1, 5000, DEFAULT_TCG_CONFIG.pityLegendary),
    exchangePoints: clampNum(r.exchangePoints, 1, 10000, DEFAULT_TCG_CONFIG.exchangePoints),
    marketFeePercent: clampNum(r.marketFeePercent, 0, 50, DEFAULT_TCG_CONFIG.marketFeePercent),
    sellRatePercent: clampNum(r.sellRatePercent, 10, 100, DEFAULT_TCG_CONFIG.sellRatePercent),
    priceCoinsPerUsd: clampNum(r.priceCoinsPerUsd, 1, 1_000_000, DEFAULT_TCG_CONFIG.priceCoinsPerUsd),
    marketMinPrice: clampNum(r.marketMinPrice, 1, 1_000_000, DEFAULT_TCG_CONFIG.marketMinPrice),
    deckSize: clampNum(r.deckSize, 1, 100, DEFAULT_TCG_CONFIG.deckSize),
    deckMaxCopies: clampNum(r.deckMaxCopies, 1, 30, DEFAULT_TCG_CONFIG.deckMaxCopies),
    deckMinSpecies: clampNum(r.deckMinSpecies, 1, 100, DEFAULT_TCG_CONFIG.deckMinSpecies),
    maxDecks: clampNum(r.maxDecks, 1, 20, DEFAULT_TCG_CONFIG.maxDecks),
    beginnerMaxPulls: clampNum(r.beginnerMaxPulls, 1, 10000, DEFAULT_TCG_CONFIG.beginnerMaxPulls),
  };
}

/** Shards received when burning an instance, by rarity. */
export const BURN_SHARDS: Record<TcgRarity, number> = {
  Common: 1, Uncommon: 3, Rare: 8, Epic: 25, Legendary: 80, Mythical: 150, Fabled: 300,
};

/** Reference value of one instance (leaderboard / collection value). */
export const BASE_VALUE: Record<TcgRarity, number> = {
  Common: 50, Uncommon: 150, Rare: 500, Epic: 2000, Legendary: 9000, Mythical: 20000, Fabled: 50000,
};


/**
 * A card INSTANCE's own Coins value (spec 6.24): rarity base scaled by
 * level (+2% per level past 1) and enhancement (+15% per +1). Selling
 * to the system pays sellRatePercent of this.
 */
/**
 * Snap a money amount to 4 decimal places — the storage scale of
 * NUMERIC(14,4) (migration 0025). Prices keep their exact cents
 * (spec 6.29: no rounding to whole Coins); this only removes binary
 * float noise, it never rounds a real price up or down to an integer.
 */
export function snapMoney(x: number): number {
  return Math.round(x * 10000) / 10000;
}

/**
 * Internal market price after one completed sale (spec 6.29): the
 * imported API price is only the starting point — from then on the
 * reference price follows OUR market. Blend: plain moving average for
 * the first 10 sales, then an EMA (alpha 0.2); every single sale may
 * move the reference at most ±25% (anti-manipulation clamp).
 */
export function nextMarketPrice(
  current: number | null,
  seedValue: number,
  salePrice: number,
  salesCount: number,
): number {
  const ref = current != null && current > 0 ? current : seedValue;
  if (!(ref > 0)) return snapMoney(salePrice);
  const blended =
    salesCount < 10
      ? (ref * salesCount + salePrice) / (salesCount + 1)
      : ref + 0.2 * (salePrice - ref);
  const clamped = Math.min(ref * 1.25, Math.max(ref * 0.75, blended));
  return snapMoney(clamped);
}

export function cardValueCoins(
  rarity: TcgRarity,
  level: number,
  enhance: number,
  priceUsd?: number,
  coinsPerUsd?: number,
  marketPriceCoins?: number,
): number {
  // Value resolution (spec 6.29): the internal market price wins once
  // the species has traded; before that the imported API price (the
  // starting price) applies; species with neither fall back to the
  // rarity table.
  const base =
    typeof marketPriceCoins === "number" && marketPriceCoins > 0
      ? marketPriceCoins
      : typeof priceUsd === "number" && priceUsd > 0
        ? priceUsd * (coinsPerUsd ?? DEFAULT_TCG_CONFIG.priceCoinsPerUsd)
        : (BASE_VALUE[rarity] ?? 0);
  const mult = 1 + Math.max(0, level - 1) * 0.02 + Math.max(0, enhance) * 0.15;
  return snapMoney(base * mult);
}
export interface PityState {
  sinceEpic: number;
  sinceLegendary: number;
  totalPulls: number;
  summonPoints: number;
}

export const emptyPity = (): PityState => ({ sinceEpic: 0, sinceLegendary: 0, totalPulls: 0, summonPoints: 0 });

/**
 * Roll one rarity. Pity: when the NEXT pull reaches the threshold
 * the roll is restricted to that tier or above (weighted by rates).
 */
export function rollRarity(rng: () => number, cfg: TcgConfig, pity: PityState): TcgRarity {
  const rollAmong = (minRank: number): TcgRarity => {
    const tiers = TCG_RARITIES.filter((r) => rarityRank(r) >= minRank);
    const total = tiers.reduce((s, r) => s + cfg.rates[r], 0);
    let x = rng() * total;
    for (const r of tiers) {
      x -= cfg.rates[r];
      if (x <= 0) return r;
    }
    return tiers[tiers.length - 1]!;
  };
  if (pity.sinceLegendary + 1 >= cfg.pityLegendary) return rollAmong(rarityRank("Legendary"));
  if (pity.sinceEpic + 1 >= cfg.pityEpic) return rollAmong(rarityRank("Epic"));
  return rollAmong(0);
}

/** Advance pity counters after a pull of the given rarity. */
export function advancePity(pity: PityState, rarity: TcgRarity): PityState {
  return {
    sinceEpic: rarityRank(rarity) >= rarityRank("Epic") ? 0 : pity.sinceEpic + 1,
    sinceLegendary: rarityRank(rarity) >= rarityRank("Legendary") ? 0 : pity.sinceLegendary + 1,
    totalPulls: pity.totalPulls + 1,
    summonPoints: pity.summonPoints + 1,
  };
}

export interface TcgSpecies {
  id: string;
  name: string;
  rarity: TcgRarity;
  /** Next evolution species id, when any (game_species.evolves_to). */
  evolvesTo?: string;
  /** Base stats for card battles (game_species.base_hp / base_atk). */
  baseHp?: number;
  baseAtk?: number;
  /** Member-exclusive card: only members can pull it (spec 6.19). */
  memberExclusive?: boolean;
  /** Card set this species belongs to (spec 6.27). */
  setId?: string;
  /** Real market price in USD (game_species.price_usd), when known. */
  priceUsd?: number;
  /** Internal market reference price in Coins (game_species.market_price_coins). */
  marketPriceCoins?: number;
}

/** Pick a species of the rolled rarity; featured species weigh x5. */
export function pickSpecies(
  rng: () => number,
  pool: TcgSpecies[],
  rarity: TcgRarity,
  featured: string[],
): TcgSpecies | null {
  const ofRarity = pool.filter((s) => s.rarity === rarity);
  if (ofRarity.length === 0) return null;
  const weighted = ofRarity.map((s) => ({ s, w: featured.includes(s.id) ? 5 : 1 }));
  const total = weighted.reduce((a, b) => a + b.w, 0);
  let x = rng() * total;
  for (const { s, w } of weighted) {
    x -= w;
    if (x <= 0) return s;
  }
  return weighted[weighted.length - 1]!.s;
}

export interface CardInstance {
  code: string;
  userId: string;
  speciesId: string;
  level: number;
  xp: number;
  enhance: number;
  locked: boolean;
  favorite: boolean;
  obtained: string;
  createdAt: Date;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export function newInstanceCode(rng: () => number): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[Math.floor(rng() * CODE_ALPHABET.length)];
  return out;
}

/** Upgrade cost (shards) from level L to L+1. */
export const upgradeCost = (level: number) => level * 2;
/** Enhance cost (shards) from +N to +N+1. */
export const enhanceCost = (enhance: number) => (enhance + 1) * 15;
export const MAX_ENHANCE = 10;
export const MAX_LEVEL = 100;

/** XP needed to go from level L to L+1. */
export const xpForLevel = (level: number) => 50 + level * 25;

export interface DeckRules {
  size: number;
  maxCopies: number;
  minSpecies: number;
}

export function validateDeck(speciesIds: string[], rules: DeckRules): string[] {
  const errors: string[] = [];
  if (speciesIds.length !== rules.size) {
    errors.push(`Bộ bài phải có đúng ${rules.size} thẻ (đang có ${speciesIds.length}).`);
  }
  const counts = new Map<string, number>();
  for (const id of speciesIds) counts.set(id, (counts.get(id) ?? 0) + 1);
  for (const [id, n] of counts) {
    if (n > rules.maxCopies) errors.push(`Loài ${id} có ${n} bản, tối đa ${rules.maxCopies}.`);
  }
  if (counts.size < rules.minSpecies) {
    errors.push(`Bộ bài cần ít nhất ${rules.minSpecies} loài khác nhau (đang có ${counts.size}).`);
  }
  return errors;
}

/* ---------------- achievements ------------------------------------ */
export interface TcgStats {
  totalPulls: number;
  speciesOwned: number;
  totalSpecies: number;
  hasLegendary: boolean;
  hasFabled: boolean;
  validDecks: number;
  salesCount: number;
  salesCoins: number;
}

export interface AchievementDef {
  id: string;
  name: string;
  reward: { coins?: number; packs?: number; shards?: number };
  met: (s: TcgStats) => boolean;
  progress: (s: TcgStats) => string;
}

const pulls = (n: number, coins: number): AchievementDef => ({
  id: `pulls_${n}`,
  name: `Mở tổng cộng ${n} thẻ`,
  reward: { coins },
  met: (s) => s.totalPulls >= n,
  progress: (s) => `${Math.min(s.totalPulls, n)}/${n} lượt`,
});
const species = (n: number, reward: AchievementDef["reward"]): AchievementDef => ({
  id: `species_${n}`,
  name: `Sưu tập ${n} loài khác nhau`,
  reward,
  met: (s) => s.speciesOwned >= n,
  progress: (s) => `${Math.min(s.speciesOwned, n)}/${n} loài`,
});

export const ACHIEVEMENTS: AchievementDef[] = [
  pulls(10, 500),
  pulls(100, 3000),
  pulls(500, 15000),
  pulls(1000, 40000),
  species(25, { coins: 1000 }),
  species(100, { coins: 5000, packs: 1 }),
  species(200, { coins: 12000, packs: 2 }),
  species(300, { coins: 30000, packs: 3 }),
  species(411, { coins: 100000, packs: 5 }),
  {
    id: "first_legendary", name: "Sở hữu thẻ Legendary đầu tiên", reward: { coins: 2000 },
    met: (s) => s.hasLegendary, progress: (s) => (s.hasLegendary ? "Đã đạt" : "Chưa có"),
  },
  {
    id: "first_fabled", name: "Sở hữu thẻ Fabled đầu tiên", reward: { coins: 10000, packs: 1 },
    met: (s) => s.hasFabled, progress: (s) => (s.hasFabled ? "Đã đạt" : "Chưa có"),
  },
  {
    id: "first_deck", name: "Có 1 bộ bài hợp lệ", reward: { coins: 1000 },
    met: (s) => s.validDecks >= 1, progress: (s) => `${Math.min(s.validDecks, 1)}/1 bộ`,
  },
  {
    id: "first_sale", name: "Bán thành công thẻ đầu tiên trên chợ", reward: { coins: 1000 },
    met: (s) => s.salesCount >= 1, progress: (s) => `${Math.min(s.salesCount, 1)}/1 lần`,
  },
  {
    id: "sales_100k", name: "Doanh thu chợ đạt 100.000 Coins", reward: { coins: 5000, packs: 1 },
    met: (s) => s.salesCoins >= 100000, progress: (s) => `${Math.min(s.salesCoins, 100000).toLocaleString("vi-VN")}/100.000`,
  },
];

/* ---------------- banners ------------------------------------------ */
export interface TcgBanner {
  id: string;
  name: string;
  kind: "standard" | "limited" | "event" | "beginner";
  featuredSpecies: string[];
  poolSpecies: string[];
  /** Game banners: pool = every species whose id starts with this prefix (0035). */
  poolPrefix: string | null;
  costCoins: number;
  startsAt: Date | null;
  endsAt: Date | null;
  enabled: boolean;
}

/** Pool membership: explicit list wins, then game prefix, else full catalog. */
export const inBannerPool = (b: TcgBanner, speciesId: string): boolean =>
  b.poolSpecies.length
    ? b.poolSpecies.includes(speciesId)
    : b.poolPrefix
      ? speciesId.startsWith(b.poolPrefix)
      : true;

export const bannerActive = (b: TcgBanner, now: Date): boolean =>
  b.enabled && (!b.startsAt || b.startsAt <= now) && (!b.endsAt || b.endsAt > now);
