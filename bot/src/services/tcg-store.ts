/**
 * TCG persistence interface + in-memory implementation + the game
 * service that orchestrates pulls/market/trades over any store.
 * PostgreSQL implementation: db/pg-tcg-store.ts.
 */
import {
  BURN_SHARDS,
  MAX_LEVEL,
  advancePity,
  cardValueCoins,
  nextMarketPrice,
  snapMoney,
  bannerActive,
  emptyPity,
  newInstanceCode,
  pickSpecies,
  rarityRank,
  rollRarity,
  type CardInstance,
  type PityState,
  type TcgBanner,
  type TcgConfig,
  type TcgRarity,
  type TcgSpecies,
} from "./tcg";
import {
  eloDelta,
  freshRankedProfile,
  rankTierFor,
  rolloverProfile,
  type Duel,
  type DuelStatus,
  type RankedProfile,
} from "./tcg-ranked";
import { battleStatsFor, simulateCardBattle, type BattleCardInput } from "./tcg-battle";

export interface TcgWallet {
  shards: number;
  packsStandard: number;
  packsPremium: number;
}

export interface Deck {
  id: number;
  userId: string;
  name: string;
  isActive: boolean;
  codes: string[];
}

export interface Listing {
  id: number;
  sellerId: string;
  instanceCode: string;
  price: number;
  status: "open" | "sold" | "cancelled" | "expired";
  buyerId: string | null;
  createdAt: Date;
}

export interface Trade {
  id: number;
  fromUser: string;
  toUser: string;
  offerCodes: string[];
  offerCoins: number;
  status: "pending" | "accepted" | "rejected" | "cancelled";
  createdAt: Date;
}

export interface PullRecord {
  userId: string;
  bannerId: string;
  speciesId: string;
  rarity: TcgRarity;
  instanceCode: string | null;
  at: Date;
}

export interface TcgStore {
  listBanners(): Promise<TcgBanner[]>;
  getBanner(id: string): Promise<TcgBanner | null>;
  getPity(userId: string, bannerId: string): Promise<PityState>;
  savePity(userId: string, bannerId: string, pity: PityState): Promise<void>;
  totalPullsAll(userId: string): Promise<number>;
  createInstance(userId: string, speciesId: string, obtained: string): Promise<CardInstance>;
  getInstance(code: string): Promise<CardInstance | null>;
  listInstances(userId: string): Promise<CardInstance[]>;
  updateInstance(code: string, patch: Partial<Pick<CardInstance, "level" | "xp" | "enhance" | "locked" | "favorite" | "userId">>): Promise<void>;
  deleteInstance(code: string): Promise<void>;
  recordPull(rec: PullRecord): Promise<void>;
  pullHistory(userId: string, limit: number): Promise<PullRecord[]>;
  wallet(userId: string): Promise<TcgWallet>;
  adjustWallet(userId: string, delta: Partial<TcgWallet>): Promise<TcgWallet>;
  claimOnce(userId: string, kind: "daily" | "weekly", period: string): Promise<boolean>;
  listDecks(userId: string): Promise<Deck[]>;
  createDeck(userId: string, name: string): Promise<Deck>;
  getDeck(id: number): Promise<Deck | null>;
  setDeckCards(deckId: number, codes: string[]): Promise<void>;
  deleteDeck(id: number): Promise<void>;
  setActiveDeck(userId: string, deckId: number): Promise<void>;
  createListing(sellerId: string, instanceCode: string, price: number): Promise<Listing>;
  getListing(id: number): Promise<Listing | null>;
  listOpenListings(): Promise<Listing[]>;
  closeListing(id: number, status: Listing["status"], buyerId?: string): Promise<void>;
  listingsOf(userId: string): Promise<Listing[]>;
  listingForInstance(code: string): Promise<Listing | null>;
  /** Record one completed market sale into the species' internal
   * market price (spec 6.29). seedValue = imported starting value. */
  recordMarketSale(speciesId: string, salePrice: number, seedValue: number): Promise<void>;
  createTrade(fromUser: string, toUser: string, codes: string[], coins: number): Promise<Trade>;
  getTrade(id: number): Promise<Trade | null>;
  resolveTrade(id: number, status: Trade["status"]): Promise<void>;
  tradeHistory(userId: string, limit: number): Promise<Trade[]>;
  claimedAchievements(userId: string): Promise<string[]>;
  claimAchievement(userId: string, id: string): Promise<void>;
  getPrefs(userId: string): Promise<Record<string, unknown>>;
  setPrefs(userId: string, prefs: Record<string, unknown>): Promise<void>;
  topCollectors(limit: number): Promise<{ userId: string; species: number; instances: number }[]>;
  // Ranked + duels (spec 6.26)
  getRankedProfile(userId: string): Promise<RankedProfile | null>;
  saveRankedProfile(p: RankedProfile): Promise<void>;
  listRankedCandidates(excludeUserId: string, limit: number): Promise<string[]>;
  createDuel(challengerId: string, opponentId: string, wager: number): Promise<Duel>;
  getDuel(id: number): Promise<Duel | null>;
  pendingDuelFor(opponentId: string): Promise<Duel | null>;
  resolveDuel(id: number, status: DuelStatus, winnerId?: string): Promise<void>;
}

export class InMemoryTcgStore implements TcgStore {
  private banners: TcgBanner[] = [
    { id: "standard", name: "Banner Chuẩn", kind: "standard", featuredSpecies: [], poolSpecies: [], costCoins: 500, startsAt: null, endsAt: null, enabled: true },
    { id: "beginner", name: "Banner Tân Thủ", kind: "beginner", featuredSpecies: [], poolSpecies: [], costCoins: 250, startsAt: null, endsAt: null, enabled: true },
  ];
  private pity = new Map<string, PityState>();
  private instances = new Map<string, CardInstance>();
  private pulls: PullRecord[] = [];
  private wallets = new Map<string, TcgWallet>();
  private claims = new Set<string>();
  private decks: Deck[] = [];
  private listings: Listing[] = [];
  private trades: Trade[] = [];
  private achievements = new Map<string, string[]>();
  private ranked = new Map<string, RankedProfile>();
  private duels: Duel[] = [];
  private prefs = new Map<string, Record<string, unknown>>();
  private seq = 1;

  async listBanners() { return [...this.banners]; }
  async getBanner(id: string) { return this.banners.find((b) => b.id === id) ?? null; }
  async getPity(userId: string, bannerId: string) {
    return { ...(this.pity.get(`${userId}:${bannerId}`) ?? emptyPity()) };
  }
  async savePity(userId: string, bannerId: string, pity: PityState) {
    this.pity.set(`${userId}:${bannerId}`, { ...pity });
  }
  async totalPullsAll(userId: string) { return this.pulls.filter((p) => p.userId === userId).length; }
  async createInstance(userId: string, speciesId: string, obtained: string) {
    let code = newInstanceCode(Math.random);
    while (this.instances.has(code)) code = newInstanceCode(Math.random);
    const inst: CardInstance = {
      code, userId, speciesId, level: 1, xp: 0, enhance: 0,
      locked: false, favorite: false, obtained, createdAt: new Date(),
    };
    this.instances.set(code, inst);
    return { ...inst };
  }
  async getInstance(code: string) {
    const i = this.instances.get(code.toUpperCase());
    return i ? { ...i } : null;
  }
  async listInstances(userId: string) {
    return [...this.instances.values()].filter((i) => i.userId === userId).map((i) => ({ ...i }));
  }
  async updateInstance(code: string, patch: Partial<CardInstance>) {
    const i = this.instances.get(code.toUpperCase());
    if (i) Object.assign(i, patch);
  }
  async deleteInstance(code: string) { this.instances.delete(code.toUpperCase()); }
  async recordPull(rec: PullRecord) { this.pulls.push(rec); }
  async pullHistory(userId: string, limit: number) {
    return this.pulls.filter((p) => p.userId === userId).slice(-limit).reverse();
  }
  async wallet(userId: string) {
    return { ...(this.wallets.get(userId) ?? { shards: 0, packsStandard: 0, packsPremium: 0 }) };
  }
  async adjustWallet(userId: string, delta: Partial<TcgWallet>) {
    const w = await this.wallet(userId);
    const next = {
      shards: Math.max(0, w.shards + (delta.shards ?? 0)),
      packsStandard: Math.max(0, w.packsStandard + (delta.packsStandard ?? 0)),
      packsPremium: Math.max(0, w.packsPremium + (delta.packsPremium ?? 0)),
    };
    this.wallets.set(userId, next);
    return { ...next };
  }
  async claimOnce(userId: string, kind: "daily" | "weekly", period: string) {
    const key = `${userId}:${kind}:${period}`;
    if (this.claims.has(key)) return false;
    this.claims.add(key);
    return true;
  }
  async listDecks(userId: string) {
    return this.decks.filter((d) => d.userId === userId).map((d) => ({ ...d, codes: [...d.codes] }));
  }
  async createDeck(userId: string, name: string) {
    const deck: Deck = { id: this.seq++, userId, name, isActive: false, codes: [] };
    this.decks.push(deck);
    return { ...deck };
  }
  async getDeck(id: number) {
    const d = this.decks.find((x) => x.id === id);
    return d ? { ...d, codes: [...d.codes] } : null;
  }
  async setDeckCards(deckId: number, codes: string[]) {
    const d = this.decks.find((x) => x.id === deckId);
    if (d) d.codes = [...codes];
  }
  async deleteDeck(id: number) { this.decks = this.decks.filter((d) => d.id !== id); }
  async setActiveDeck(userId: string, deckId: number) {
    for (const d of this.decks) if (d.userId === userId) d.isActive = d.id === deckId;
  }
  async createListing(sellerId: string, instanceCode: string, price: number) {
    const l: Listing = { id: this.seq++, sellerId, instanceCode, price, status: "open", buyerId: null, createdAt: new Date() };
    this.listings.push(l);
    return { ...l };
  }
  async getListing(id: number) {
    const l = this.listings.find((x) => x.id === id);
    return l ? { ...l } : null;
  }
  async listOpenListings() { return this.listings.filter((l) => l.status === "open").map((l) => ({ ...l })); }
  async closeListing(id: number, status: Listing["status"], buyerId?: string) {
    const l = this.listings.find((x) => x.id === id);
    if (l) { l.status = status; l.buyerId = buyerId ?? null; }
  }
  async listingsOf(userId: string) { return this.listings.filter((l) => l.sellerId === userId).map((l) => ({ ...l })); }
  async listingForInstance(code: string) {
    const l = this.listings.find((x) => x.instanceCode === code.toUpperCase() && x.status === "open");
    return l ? { ...l } : null;
  }
  private marketPrices = new Map<string, { price: number | null; sales: number }>();
  async recordMarketSale(speciesId: string, salePrice: number, seedValue: number) {
    const cur = this.marketPrices.get(speciesId) ?? { price: null, sales: 0 };
    const next = nextMarketPrice(cur.price, seedValue, salePrice, cur.sales);
    this.marketPrices.set(speciesId, { price: next, sales: cur.sales + 1 });
  }
  async createTrade(fromUser: string, toUser: string, codes: string[], coins: number) {
    const t: Trade = { id: this.seq++, fromUser, toUser, offerCodes: codes, offerCoins: coins, status: "pending", createdAt: new Date() };
    this.trades.push(t);
    return { ...t };
  }
  async getTrade(id: number) {
    const t = this.trades.find((x) => x.id === id);
    return t ? { ...t } : null;
  }
  async resolveTrade(id: number, status: Trade["status"]) {
    const t = this.trades.find((x) => x.id === id);
    if (t) t.status = status;
  }
  async tradeHistory(userId: string, limit: number) {
    return this.trades.filter((t) => t.fromUser === userId || t.toUser === userId).slice(-limit).reverse();
  }
  async claimedAchievements(userId: string) { return [...(this.achievements.get(userId) ?? [])]; }
  async claimAchievement(userId: string, id: string) {
    const list = this.achievements.get(userId) ?? [];
    list.push(id);
    this.achievements.set(userId, list);
  }
  async getRankedProfile(userId: string) {
    const p = this.ranked.get(userId);
    return p ? { ...p } : null;
  }
  async saveRankedProfile(p: RankedProfile) { this.ranked.set(p.userId, { ...p }); }
  async listRankedCandidates(excludeUserId: string, limit: number) {
    const owners = new Set(this.decks.filter((d) => d.codes.length >= 5).map((d) => d.userId));
    return [...owners].filter((u) => u !== excludeUserId).slice(0, limit);
  }
  async createDuel(challengerId: string, opponentId: string, wager: number) {
    const d: Duel = {
      id: this.duels.length + 1, challengerId, opponentId, wager,
      status: "pending", winnerId: null, createdAt: new Date(), resolvedAt: null,
    };
    this.duels.push(d);
    return { ...d };
  }
  async getDuel(id: number) {
    const d = this.duels.find((x) => x.id === id);
    return d ? { ...d } : null;
  }
  async pendingDuelFor(opponentId: string) {
    const d = [...this.duels].reverse().find((x) => x.opponentId === opponentId && x.status === "pending");
    return d ? { ...d } : null;
  }
  async resolveDuel(id: number, status: DuelStatus, winnerId?: string) {
    const d = this.duels.find((x) => x.id === id);
    if (d && d.status === "pending") {
      d.status = status;
      d.winnerId = winnerId ?? null;
      d.resolvedAt = new Date();
    }
  }
  async getPrefs(userId: string) { return { ...(this.prefs.get(userId) ?? {}) }; }
  async setPrefs(userId: string, prefs: Record<string, unknown>) { this.prefs.set(userId, { ...prefs }); }
  async topCollectors(limit: number) {
    const byUser = new Map<string, { species: Set<string>; instances: number }>();
    for (const i of this.instances.values()) {
      const e = byUser.get(i.userId) ?? { species: new Set<string>(), instances: 0 };
      e.species.add(i.speciesId);
      e.instances++;
      byUser.set(i.userId, e);
    }
    return [...byUser.entries()]
      .map(([userId, e]) => ({ userId, species: e.species.size, instances: e.instances }))
      .sort((a, b) => b.species - a.species || b.instances - a.instances)
      .slice(0, limit);
  }
}

/* ---------------- game service -------------------------------------- */
export interface TcgEconomyHooks {
  debit(userId: string, amount: number, source: string, note?: string): Promise<boolean>;
  credit(userId: string, amount: number, source: string, note?: string): Promise<void>;
  balance(userId: string): Promise<number>;
}

export interface PullOutcome {
  instance: CardInstance;
  species: TcgSpecies;
  rarity: TcgRarity;
}

export class TcgGameService {
  constructor(
    private readonly deps: {
      store: TcgStore;
      catalog: () => Promise<TcgSpecies[]>;
      config: () => Promise<TcgConfig>;
      economy: TcgEconomyHooks;
      /** Membership perks resolver (spec 6.19 TCG benefits). */
      memberPerks?: (userId: string) => Promise<import("./membership").EffectivePerks | null>;
      rng?: () => number;
      now?: () => Date;
    },
  ) {}

  private rng() { return this.deps.rng ? this.deps.rng() : Math.random(); }
  private now() { return this.deps.now ? this.deps.now() : new Date(); }

  async pull(userId: string, bannerId: string, count: 1 | 10): Promise<
    | { kind: "ok"; results: PullOutcome[]; cost: number }
    | { kind: "error"; message: string }
  > {
    const cfg = await this.deps.config();
    const banner = await this.deps.store.getBanner(bannerId);
    if (!banner || !bannerActive(banner, this.now())) {
      return { kind: "error", message: "Banner này không còn mở." };
    }
    if (banner.kind === "beginner") {
      const total = await this.deps.store.totalPullsAll(userId);
      if (total >= cfg.beginnerMaxPulls) {
        return { kind: "error", message: "Banner Tân Thủ chỉ dành cho tài khoản dưới 30 lượt mở." };
      }
    }
    const pullPerks = this.deps.memberPerks
      ? await this.deps.memberPerks(userId).catch(() => null)
      : null;
    const catalogAll = await this.deps.catalog();
    // Member-exclusive cards only enter the pool for members.
    const catalog = pullPerks?.exclusivePets
      ? catalogAll
      : catalogAll.filter((s) => !s.memberExclusive);
    const pool = banner.poolSpecies.length
      ? catalog.filter((s) => banner.poolSpecies.includes(s.id))
      : catalog;
    if (pool.length === 0) return { kind: "error", message: "Danh mục thẻ đang trống." };
    const unitCost = banner.kind === "beginner" ? cfg.beginnerCostCoins : banner.costCoins || cfg.pullCostCoins;
    let cost = unitCost * count;
    // Member benefit: % off gacha pulls.
    if (pullPerks && pullPerks.gachaDiscountPercent > 0) {
      cost = Math.max(0, Math.floor((cost * (100 - pullPerks.gachaDiscountPercent)) / 100));
    }
    if (cost > 0) {
      const ok = await this.deps.economy.debit(userId, cost, "tcg-gacha", `Mở thẻ banner ${banner.name}`);
      if (!ok) return { kind: "error", message: `Không đủ Coins — cần ${cost.toLocaleString("vi-VN")}.` };
    }
    const pity = await this.deps.store.getPity(userId, bannerId);
    const results: PullOutcome[] = [];
    let state = { ...pity };
    for (let i = 0; i < count; i++) {
      let rarity = rollRarity(() => this.rng(), cfg, state);
      // Multi guarantee: the 10th pull is at least Rare when nothing Rare+ appeared.
      if (count === 10 && i === 9 && results.every((r) => rarityRank(r.rarity) < rarityRank("Rare"))) {
        rarity = "Rare";
      }
      // Beginner first multi: guaranteed Legendary in the 10th slot.
      if (banner.kind === "beginner" && count === 10 && i === 9 && pity.totalPulls === 0) {
        rarity = "Legendary";
      }
      let species = pickSpecies(() => this.rng(), pool, rarity, banner.featuredSpecies);
      if (!species) {
        // Pool lacks this rarity (small event pools): fall back down a tier.
        const lower = [...new Set(pool.map((s) => s.rarity))].sort((a, b) => rarityRank(b) - rarityRank(a))[0];
        if (!lower) return { kind: "error", message: "Pool banner trống." };
        rarity = lower;
        species = pickSpecies(() => this.rng(), pool, rarity, banner.featuredSpecies)!;
      }
      const instance = await this.deps.store.createInstance(userId, species.id, "gacha");
      await this.deps.store.recordPull({
        userId, bannerId, speciesId: species.id, rarity, instanceCode: instance.code, at: this.now(),
      });
      state = advancePity(state, rarity);
      results.push({ instance, species, rarity });
    }
    await this.deps.store.savePity(userId, bannerId, state);
    return { kind: "ok", results, cost };
  }

  /** Open a free pack: 5 standard pulls, no coin cost, pity applies. */
  async openPack(userId: string, premium: boolean): Promise<
    | { kind: "ok"; results: PullOutcome[] }
    | { kind: "error"; message: string }
  > {
    const wallet = await this.deps.store.wallet(userId);
    if (premium && wallet.packsPremium <= 0) return { kind: "error", message: "Bạn không có Gói Cao Cấp nào." };
    if (!premium && wallet.packsStandard <= 0) return { kind: "error", message: "Bạn không có Gói Thường nào." };
    await this.deps.store.adjustWallet(userId, premium ? { packsPremium: -1 } : { packsStandard: -1 });
    const cfg = await this.deps.config();
    const packPerks = this.deps.memberPerks
      ? await this.deps.memberPerks(userId).catch(() => null)
      : null;
    const catalogAll = await this.deps.catalog();
    const catalog = packPerks?.exclusivePets
      ? catalogAll
      : catalogAll.filter((s) => !s.memberExclusive);
    const pity = await this.deps.store.getPity(userId, "standard");
    let state = { ...pity };
    const results: PullOutcome[] = [];
    for (let i = 0; i < 5; i++) {
      let rarity = rollRarity(() => this.rng(), cfg, state);
      if (premium && i === 4 && results.every((r) => rarityRank(r.rarity) < rarityRank("Epic"))) {
        rarity = "Epic";
      }
      const species = pickSpecies(() => this.rng(), catalog, rarity, []);
      if (!species) continue;
      const instance = await this.deps.store.createInstance(userId, species.id, premium ? "pack-premium" : "pack");
      await this.deps.store.recordPull({
        userId, bannerId: "standard", speciesId: species.id, rarity, instanceCode: instance.code, at: this.now(),
      });
      state = advancePity(state, rarity);
      results.push({ instance, species, rarity });
    }
    await this.deps.store.savePity(userId, "standard", state);
    return { kind: "ok", results };
  }

  /** Burn an instance into shards. Locked/favorite/listed/decked cards refuse. */
  async burn(userId: string, code: string, deckCodes: Set<string>): Promise<
    | { kind: "ok"; shards: number }
    | { kind: "error"; message: string }
  > {
    const inst = await this.deps.store.getInstance(code);
    if (!inst || inst.userId !== userId) return { kind: "error", message: "Không tìm thấy thẻ đó trong kho của bạn." };
    if (inst.locked) return { kind: "error", message: "Thẻ đang khoá — mở khoá trước khi phân giải." };
    if (inst.favorite) return { kind: "error", message: "Thẻ đang đánh dấu yêu thích — bỏ yêu thích trước." };
    if (deckCodes.has(inst.code)) return { kind: "error", message: "Thẻ đang nằm trong một bộ bài — gỡ khỏi bộ bài trước." };
    if (await this.deps.store.listingForInstance(inst.code)) {
      return { kind: "error", message: "Thẻ đang được bán trên chợ — huỷ tin đăng trước." };
    }
    const catalog = await this.deps.catalog();
    const species = catalog.find((s) => s.id === inst.speciesId);
    const shards = BURN_SHARDS[(species?.rarity ?? "Common") as TcgRarity] ?? 1;
    await this.deps.store.deleteInstance(inst.code);
    await this.deps.store.adjustWallet(userId, { shards });
    return { kind: "ok", shards };
  }

  /** Shared guards for destroying/leaving an instance (burn + sell). */
  private async guardRemovable(
    userId: string,
    code: string,
    deckCodes: Set<string>,
  ): Promise<{ inst: CardInstance } | { error: string }> {
    const inst = await this.deps.store.getInstance(code);
    if (!inst || inst.userId !== userId) return { error: "Không tìm thấy thẻ đó trong kho của bạn." };
    if (inst.locked) return { error: "Thẻ đang khoá — mở khoá trước." };
    if (inst.favorite) return { error: "Thẻ đang đánh dấu yêu thích — bỏ yêu thích trước." };
    if (deckCodes.has(inst.code)) return { error: "Thẻ đang nằm trong một bộ bài — gỡ khỏi bộ bài trước." };
    if (await this.deps.store.listingForInstance(inst.code)) {
      return { error: "Thẻ đang được bán trên chợ — huỷ tin đăng trước." };
    }
    return { inst };
  }

  /**
   * Sell a card to the SYSTEM for Coins (spec 6.24) — pays
   * sellRatePercent of the instance's own value. Distinct from burn
   * (shards) and from the player market.
   */
  async sellCard(userId: string, code: string, deckCodes: Set<string>): Promise<
    | { kind: "ok"; coins: number; value: number }
    | { kind: "error"; message: string }
  > {
    const guarded = await this.guardRemovable(userId, code, deckCodes);
    if ("error" in guarded) return { kind: "error", message: guarded.error };
    const inst = guarded.inst;
    const catalog = await this.deps.catalog();
    const species = catalog.find((s) => s.id === inst.speciesId);
    const rarity = (species?.rarity ?? "Common") as TcgRarity;
    const cfg = await this.deps.config();
    const value = cardValueCoins(rarity, inst.level, inst.enhance, species?.priceUsd, cfg.priceCoinsPerUsd, species?.marketPriceCoins);
    const coins = snapMoney((value * cfg.sellRatePercent) / 100);
    await this.deps.store.deleteInstance(inst.code);
    await this.deps.economy.credit(userId, coins, "tcg-sell", `Bán thẻ ${inst.code}`);
    return { kind: "ok", coins, value };
  }

  /**
   * Card battle (spec 6.24): the first 5 cards of the ACTIVE deck
   * fight an auto-generated rival team of similar power. Winners earn
   * Coins + card XP (100 XP = +1 level, up to the cap).
   */
  async cardBattle(userId: string): Promise<
    | {
        kind: "ok";
        win: boolean;
        rounds: number;
        log: string[];
        coins: number;
        xp: number;
        teamNames: string[];
        enemyNames: string[];
        leveledUp: string[];
      }
    | { kind: "error"; message: string }
  > {
    const decks = await this.deps.store.listDecks(userId);
    const active = decks.find((d) => d.isActive) ?? decks[0];
    if (!active) {
      return { kind: "error", message: "Bạn chưa có bộ bài nào — tạo bộ bài bằng lệnh `deck create` trước." };
    }
    if (active.codes.length < 5) {
      return { kind: "error", message: `Bộ bài "${active.name}" mới có ${active.codes.length} thẻ — cần ít nhất 5 thẻ để battle.` };
    }
    const catalog = await this.deps.catalog();
    const byId = new Map(catalog.map((s) => [s.id, s]));
    const team: BattleCardInput[] = [];
    const teamInstances: CardInstance[] = [];
    for (const code of active.codes.slice(0, 5)) {
      const inst = await this.deps.store.getInstance(code);
      if (!inst || inst.userId !== userId) continue;
      const sp = byId.get(inst.speciesId);
      const stats = battleStatsFor(sp?.baseHp ?? 50, sp?.baseAtk ?? 50, inst.level, inst.enhance);
      team.push({ code: inst.code, name: sp?.name ?? inst.speciesId, speciesId: inst.speciesId, ...stats });
      teamInstances.push(inst);
    }
    if (team.length < 5) {
      return { kind: "error", message: "Bộ bài đang dùng thiếu thẻ hợp lệ — kiểm tra lại bằng `deck view`." };
    }
    const avgLevel = teamInstances.reduce((s, i) => s + i.level, 0) / teamInstances.length;
    const enemy: BattleCardInput[] = [];
    const pool = catalog.filter((s) => s.baseHp !== undefined || true);
    for (let i = 0; i < 5; i++) {
      const sp = pool[Math.floor(this.rng() * pool.length)] ?? pool[0];
      if (!sp) return { kind: "error", message: "Chưa có dữ liệu loài để tạo đối thủ." };
      const lvl = Math.max(1, Math.round(avgLevel * (0.85 + this.rng() * 0.3)));
      const stats = battleStatsFor(sp.baseHp ?? 50, sp.baseAtk ?? 50, lvl, 0);
      enemy.push({ code: `enemy-${i}`, name: sp.name, speciesId: sp.id, ...stats });
    }
    const result = simulateCardBattle(team, enemy, () => this.rng());
    const win = result.winner === "a";
    // Member benefits: +% battle Coins and +% card XP.
    const battlePerks = this.deps.memberPerks
      ? await this.deps.memberPerks(userId).catch(() => null)
      : null;
    const coins = Math.round(
      (win ? Math.round(120 + avgLevel * 15) : 25) *
        (1 + (battlePerks?.battleBonusPercent ?? 0) / 100),
    );
    const xp = Math.round((win ? 30 : 12) * (1 + (battlePerks?.xpBonusPercent ?? 0) / 100));
    const leveledUp: string[] = [];
    for (const inst of teamInstances) {
      let level = inst.level;
      let totalXp = inst.xp + xp;
      while (totalXp >= 100 && level < MAX_LEVEL) {
        totalXp -= 100;
        level += 1;
      }
      if (level > inst.level) leveledUp.push(`${byId.get(inst.speciesId)?.name ?? inst.speciesId} → Lv.${level}`);
      await this.deps.store.updateInstance(inst.code, { xp: totalXp, level });
    }
    await this.deps.economy.credit(userId, coins, "tcg-battle", win ? "Thắng battle thẻ" : "Battle thẻ");
    return {
      kind: "ok",
      win,
      rounds: result.rounds,
      log: result.log.slice(-14),
      coins,
      xp,
      teamNames: team.map((c) => c.name),
      enemyNames: enemy.map((c) => c.name),
      leveledUp,
    };
  }

  /** Build the 5-card battle team from a user's ACTIVE deck. */
  async buildDeckTeam(userId: string): Promise<
    | { kind: "ok"; team: BattleCardInput[]; deckName: string }
    | { kind: "error"; message: string }
  > {
    const decks = await this.deps.store.listDecks(userId);
    const active = decks.find((d) => d.isActive) ?? decks[0];
    if (!active) return { kind: "error", message: "Chưa có bộ bài nào." };
    if (active.codes.length < 5) {
      return { kind: "error", message: `Bộ bài "${active.name}" cần ít nhất 5 thẻ để đấu.` };
    }
    const catalog = await this.deps.catalog();
    const byId = new Map(catalog.map((s) => [s.id, s]));
    const team: BattleCardInput[] = [];
    for (const code of active.codes.slice(0, 5)) {
      const inst = await this.deps.store.getInstance(code);
      if (!inst || inst.userId !== userId) continue;
      const sp = byId.get(inst.speciesId);
      const stats = battleStatsFor(sp?.baseHp ?? 50, sp?.baseAtk ?? 50, inst.level, inst.enhance);
      team.push({ code: inst.code, name: sp?.name ?? inst.speciesId, speciesId: inst.speciesId, ...stats });
    }
    if (team.length < 5) return { kind: "error", message: "Bộ bài đang dùng thiếu thẻ hợp lệ." };
    return { kind: "ok", team, deckName: active.name };
  }

  /** Ensure a ranked profile exists with the season rolled over. */
  async rankedProfile(userId: string): Promise<RankedProfile> {
    const now = this.now();
    const stored = await this.deps.store.getRankedProfile(userId);
    const prof = rolloverProfile(stored ?? freshRankedProfile(userId, now), now);
    if (!stored || stored.season !== prof.season || stored.mmr !== prof.mmr) {
      await this.deps.store.saveRankedProfile(prof);
    }
    return prof;
  }

  /**
   * Ranked match (spec 6.26): fight another player's active-deck
   * defense team. Zero-sum Elo MMR; Coins by result with the member
   * battle bonus applied.
   */
  async rankedBattle(userId: string): Promise<
    | {
        kind: "ok"; win: boolean; rounds: number; log: string[];
        opponentId: string; coins: number; mmrDelta: number;
        myMmr: number; tierName: string; tierUp: boolean;
      }
    | { kind: "error"; message: string }
  > {
    const mine = await this.buildDeckTeam(userId);
    if (mine.kind === "error") {
      return { kind: "error", message: mine.message.replace("để đấu", "để đấu hạng") };
    }
    const candidates = await this.deps.store.listRankedCandidates(userId, 25);
    if (!candidates.length) {
      return { kind: "error", message: "Chưa có đối thủ nào có bộ bài đủ 5 thẻ để đấu hạng. Hẹn bạn quay lại sau nhé." };
    }
    const opponentId = candidates[Math.floor(this.rng() * candidates.length)];
    const theirs = await this.buildDeckTeam(opponentId);
    if (theirs.kind === "error") {
      return { kind: "error", message: "Đối thủ vừa đổi bộ bài — thử lại nhé." };
    }
    const myProf = await this.rankedProfile(userId);
    const oppProf = await this.rankedProfile(opponentId);
    const tierBefore = rankTierFor(myProf.mmr).id;
    const result = simulateCardBattle(mine.team, theirs.team, () => this.rng());
    const win = result.winner === "a";
    const winnerProf = win ? myProf : oppProf;
    const loserProf = win ? oppProf : myProf;
    const delta = eloDelta(winnerProf.mmr, loserProf.mmr);
    winnerProf.mmr += delta;
    loserProf.mmr = Math.max(0, loserProf.mmr - delta);
    winnerProf.wins += 1; winnerProf.seasonWins += 1;
    loserProf.losses += 1; loserProf.seasonLosses += 1;
    await this.deps.store.saveRankedProfile(winnerProf);
    await this.deps.store.saveRankedProfile(loserProf);
    const perks = this.deps.memberPerks
      ? await this.deps.memberPerks(userId).catch(() => null)
      : null;
    const coins = Math.round((win ? 150 : 30) * (1 + (perks?.battleBonusPercent ?? 0) / 100));
    await this.deps.economy.credit(userId, coins, "tcg-ranked", win ? "Thắng đấu hạng TCG" : "Đấu hạng TCG");
    const myNew = win ? winnerProf : loserProf;
    return {
      kind: "ok", win, rounds: result.rounds, log: result.log.slice(-10),
      opponentId, coins,
      mmrDelta: win ? delta : -delta,
      myMmr: myNew.mmr,
      tierName: rankTierFor(myNew.mmr).name,
      tierUp: rankTierFor(myNew.mmr).id !== tierBefore && win,
    };
  }

  /** Head-to-head duel between two users' active decks (no MMR). */
  async duelBattle(aId: string, bId: string): Promise<
    | { kind: "ok"; winnerId: string; rounds: number; log: string[]; aNames: string[]; bNames: string[] }
    | { kind: "error"; message: string }
  > {
    const a = await this.buildDeckTeam(aId);
    if (a.kind === "error") return { kind: "error", message: `Người thách đấu: ${a.message}` };
    const b = await this.buildDeckTeam(bId);
    if (b.kind === "error") return { kind: "error", message: `Người được thách: ${b.message}` };
    const result = simulateCardBattle(a.team, b.team, () => this.rng());
    return {
      kind: "ok",
      winnerId: result.winner === "a" ? aId : bId,
      rounds: result.rounds,
      log: result.log.slice(-10),
      aNames: a.team.map((c) => c.name),
      bNames: b.team.map((c) => c.name),
    };
  }
}
