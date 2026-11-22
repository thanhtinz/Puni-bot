/**
 * TCG persistence interface + in-memory implementation + the game
 * service that orchestrates pulls/market/trades over any store.
 * PostgreSQL implementation: db/pg-tcg-store.ts.
 */
import {
  BURN_SHARDS,
  advancePity,
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
  createTrade(fromUser: string, toUser: string, codes: string[], coins: number): Promise<Trade>;
  getTrade(id: number): Promise<Trade | null>;
  resolveTrade(id: number, status: Trade["status"]): Promise<void>;
  tradeHistory(userId: string, limit: number): Promise<Trade[]>;
  claimedAchievements(userId: string): Promise<string[]>;
  claimAchievement(userId: string, id: string): Promise<void>;
  getPrefs(userId: string): Promise<Record<string, unknown>>;
  setPrefs(userId: string, prefs: Record<string, unknown>): Promise<void>;
  topCollectors(limit: number): Promise<{ userId: string; species: number; instances: number }[]>;
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
    const catalog = await this.deps.catalog();
    const pool = banner.poolSpecies.length
      ? catalog.filter((s) => banner.poolSpecies.includes(s.id))
      : catalog;
    if (pool.length === 0) return { kind: "error", message: "Danh mục thẻ đang trống." };
    const unitCost = banner.kind === "beginner" ? cfg.beginnerCostCoins : banner.costCoins || cfg.pullCostCoins;
    const cost = unitCost * count;
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
    const catalog = await this.deps.catalog();
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
}
