/**
 * TCG social systems for the bot (spec 6.38): showcases (read-only
 * view), auctions and tournaments — the same tables and rules as the
 * web (spec 6.30/6.31), so a card listed in Discord settles on the
 * web and vice versa. Money moves through the shared economy hooks;
 * auction state changes use guarded store writes so a race can never
 * double-charge or double-settle (the loser of a race is refunded).
 */
import { battleStatsFor, simulateCardBattle, type BattleCardInput } from "./tcg-battle";
import { rngFromSeed } from "./tcg-formats";
import { deckEdition, snapMoney, validateDeck, type CardEdition, type CardInstance, type DeckRules, type TcgSpecies } from "./tcg";
import type { Deck, TcgStore } from "./tcg-store";

export const AUCTION_DURATIONS_HOURS = [1, 6, 24, 72] as const;
export const AUCTION_MIN_START = 10;
export const ANTI_SNIPE_MS = 5 * 60 * 1000;
export const TOURNAMENT_WINDOW_MS = 10 * 60 * 1000;
export const TOURNAMENT_SIZES = [8, 16] as const;

export function minNextBid(a: { startPrice: number; currentPrice: number | null }): number {
  if (a.currentPrice == null) return a.startPrice;
  return snapMoney(a.currentPrice + Math.max(5, a.currentPrice * 0.05));
}

export function totalRounds(size: number): number {
  return Math.round(Math.log2(size));
}

export function roundName(round: number, size: number): string {
  const total = totalRounds(size);
  if (round === total) return "Chung kết";
  if (round === total - 1) return "Bán kết";
  if (round === total - 2) return "Tứ kết";
  return `Vòng ${size / 2 ** (round - 1)}`;
}

// ------------------------------------------------------------------
// Store-level rows
// ------------------------------------------------------------------

export interface AuctionRow {
  id: number;
  sellerId: string;
  instanceCode: string;
  startPrice: number;
  currentPrice: number | null;
  topBidder: string | null;
  buyNowPrice: number | null;
  endsAt: Date;
  status: string; // open | sold | unsold | cancelled
  createdAt: Date;
}

export interface ShowcaseRow {
  userId: string;
  owned: boolean;
  isPublic: boolean;
  layout: string;
  theme: string;
  effect: string;
  pins: string[];
}

export interface TournamentRow {
  id: number;
  name: string;
  size: number;
  entryFee: number;
  rakePercent: number;
  prizeFirst: number;
  prizeSecond: number;
  prizeSemis: number;
  status: string; // open | running | done | cancelled
  createdBy: string;
  championId: string | null;
  /** Edition lock (spec 6.38): fixed by the first entrant's deck;
   *  null while nobody has entered yet. */
  edition: CardEdition | null;
}

export interface EntryRow {
  userId: string;
  seed: number | null;
  deckCodes: string[];
}

export interface MatchRow {
  id: number;
  tournamentId: number;
  round: number;
  slot: number;
  p1Id: string | null;
  p2Id: string | null;
  p1In: boolean;
  p2In: boolean;
  readyAt: Date | null;
  winnerId: string | null;
  result: string | null;
}

export interface SocialStore {
  // Auctions
  dueAuctions(now: Date): Promise<AuctionRow[]>;
  claimAuctionSettle(id: number, status: "sold" | "unsold"): Promise<AuctionRow | null>;
  getAuction(id: number): Promise<AuctionRow | null>;
  listOpenAuctions(): Promise<AuctionRow[]>;
  auctionsOf(sellerId: string): Promise<AuctionRow[]>;
  auctionsBidOn(userId: string): Promise<AuctionRow[]>;
  insertAuction(a: Omit<AuctionRow, "id" | "status" | "createdAt" | "currentPrice" | "topBidder">): Promise<AuctionRow>;
  applyBid(id: number, prevTop: string | null, prevPrice: number | null, bidder: string, amount: number, newEndsAt: Date | null): Promise<boolean>;
  addBidRecord(auctionId: number, bidder: string, amount: number): Promise<void>;
  countBids(auctionId: number): Promise<number>;
  claimAuctionSold(id: number, winnerId: string, price: number): Promise<AuctionRow | null>;
  cancelAuctionRow(id: number, sellerId: string): Promise<boolean>;
  bidAuctionIds(userId: string): Promise<number[]>;
  // Showcase
  getShowcaseRow(userId: string): Promise<ShowcaseRow | null>;
  // Tournaments
  listTournaments(): Promise<TournamentRow[]>;
  getTournament(id: number): Promise<TournamentRow | null>;
  insertTournament(t: Omit<TournamentRow, "id" | "status" | "championId">): Promise<TournamentRow>;
  listEntries(tournamentId: number): Promise<EntryRow[]>;
  insertEntryGuarded(tournamentId: number, userId: string, codes: string[], size: number): Promise<boolean>;
  /** Set the edition lock only while it is still unset (first entrant). */
  setTournamentEdition(id: number, edition: CardEdition): Promise<boolean>;
  removeEntry(tournamentId: number, userId: string): Promise<void>;
  lockBracket(tournamentId: number): Promise<boolean>;
  listMatches(tournamentId: number): Promise<MatchRow[]>;
  getMatch(id: number): Promise<MatchRow | null>;
  matchesOfUser(userId: string): Promise<MatchRow[]>;
  dueMatches(now: Date): Promise<MatchRow[]>;
  setMatchCheckin(matchId: number, col: "p1" | "p2"): Promise<MatchRow | null>;
  recordMatchResult(matchId: number, winnerId: string, result: string, log: string[]): Promise<boolean>;
  advanceWinner(match: MatchRow, winnerId: string): Promise<"advanced" | "final">;
  finishTournament(id: number, championId: string): Promise<void>;
}

// ------------------------------------------------------------------
// In-memory store (tests + single-process fallback)
// ------------------------------------------------------------------

export class InMemorySocialStore implements SocialStore {
  auctions: AuctionRow[] = [];
  bids: { auctionId: number; bidder: string; amount: number }[] = [];
  showcases = new Map<string, ShowcaseRow>();
  tournaments: TournamentRow[] = [];
  entries = new Map<number, EntryRow[]>();
  matches: MatchRow[] = [];
  private auctionSeq = 1;
  private tournamentSeq = 1;
  private matchSeq = 1;

  async dueAuctions(now: Date) {
    return this.auctions.filter((a) => a.status === "open" && a.endsAt.getTime() <= now.getTime());
  }
  async claimAuctionSettle(id: number, status: "sold" | "unsold") {
    const a = this.auctions.find((x) => x.id === id);
    if (!a || a.status !== "open") return null;
    a.status = status;
    return a;
  }
  async getAuction(id: number) {
    return this.auctions.find((a) => a.id === id) ?? null;
  }
  async listOpenAuctions() {
    return this.auctions.filter((a) => a.status === "open").sort((x, y) => x.endsAt.getTime() - y.endsAt.getTime());
  }
  async auctionsOf(sellerId: string) {
    return this.auctions.filter((a) => a.sellerId === sellerId).sort((x, y) => y.id - x.id);
  }
  async bidAuctionIds(userId: string) {
    return [...new Set(this.bids.filter((b) => b.bidder === userId).map((b) => b.auctionId))];
  }
  async auctionsBidOn(userId: string) {
    const ids = await this.bidAuctionIds(userId);
    return this.auctions.filter((a) => ids.includes(a.id));
  }
  async insertAuction(a: Omit<AuctionRow, "id" | "status" | "createdAt" | "currentPrice" | "topBidder">) {
    const row: AuctionRow = { ...a, id: this.auctionSeq++, status: "open", createdAt: new Date(), currentPrice: null, topBidder: null };
    this.auctions.push(row);
    return row;
  }
  async applyBid(id: number, prevTop: string | null, prevPrice: number | null, bidder: string, amount: number, newEndsAt: Date | null) {
    const a = this.auctions.find((x) => x.id === id);
    if (!a || a.status !== "open" || a.topBidder !== prevTop || a.currentPrice !== prevPrice) return false;
    a.currentPrice = amount;
    a.topBidder = bidder;
    if (newEndsAt) a.endsAt = newEndsAt;
    return true;
  }
  async addBidRecord(auctionId: number, bidder: string, amount: number) {
    this.bids.push({ auctionId, bidder, amount });
  }
  async countBids(auctionId: number) {
    return this.bids.filter((b) => b.auctionId === auctionId).length;
  }
  async claimAuctionSold(id: number, winnerId: string, price: number) {
    const a = this.auctions.find((x) => x.id === id);
    if (!a || a.status !== "open") return null;
    a.status = "sold";
    a.currentPrice = price;
    a.topBidder = winnerId;
    return a;
  }
  async cancelAuctionRow(id: number, sellerId: string) {
    const a = this.auctions.find((x) => x.id === id);
    if (!a || a.status !== "open" || a.sellerId !== sellerId || a.topBidder) return false;
    a.status = "cancelled";
    return true;
  }
  async getShowcaseRow(userId: string) {
    return this.showcases.get(userId) ?? null;
  }
  async listTournaments() {
    return [...this.tournaments].sort((a, b) => b.id - a.id);
  }
  async getTournament(id: number) {
    return this.tournaments.find((t) => t.id === id) ?? null;
  }
  async insertTournament(t: Omit<TournamentRow, "id" | "status" | "championId">) {
    const row: TournamentRow = { ...t, id: this.tournamentSeq++, status: "open", championId: null };
    this.tournaments.push(row);
    this.entries.set(row.id, []);
    return row;
  }
  async listEntries(tournamentId: number) {
    return this.entries.get(tournamentId) ?? [];
  }
  async insertEntryGuarded(tournamentId: number, userId: string, codes: string[], size: number) {
    const list = this.entries.get(tournamentId) ?? [];
    if (list.some((e) => e.userId === userId) || list.length >= size) return false;
    list.push({ userId, seed: null, deckCodes: codes });
    this.entries.set(tournamentId, list);
    return true;
  }
  async setTournamentEdition(id: number, edition: CardEdition) {
    const t = this.tournaments.find((x) => x.id === id);
    if (!t || t.edition) return false;
    t.edition = edition;
    return true;
  }
  async removeEntry(tournamentId: number, userId: string) {
    const list = this.entries.get(tournamentId) ?? [];
    this.entries.set(tournamentId, list.filter((e) => e.userId !== userId));
  }
  async lockBracket(tournamentId: number) {
    const t = this.tournaments.find((x) => x.id === tournamentId);
    if (!t || t.status !== "open") return false;
    const list = this.entries.get(tournamentId) ?? [];
    if (list.length !== t.size) return false;
    const ids = list.map((e) => e.userId);
    const rng = rngFromSeed(t.id * 7919 + 13);
    for (let i = ids.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [ids[i], ids[j]] = [ids[j], ids[i]];
    }
    ids.forEach((id, i) => {
      const e = list.find((x) => x.userId === id);
      if (e) e.seed = i + 1;
    });
    for (let slot = 0; slot < t.size / 2; slot++) {
      this.matches.push({
        id: this.matchSeq++, tournamentId, round: 1, slot,
        p1Id: ids[slot], p2Id: ids[t.size - 1 - slot],
        p1In: false, p2In: false, readyAt: new Date(), winnerId: null, result: null,
      });
    }
    t.status = "running";
    return true;
  }
  async listMatches(tournamentId: number) {
    return this.matches.filter((m) => m.tournamentId === tournamentId)
      .sort((a, b) => a.round - b.round || a.slot - b.slot);
  }
  async getMatch(id: number) {
    return this.matches.find((m) => m.id === id) ?? null;
  }
  async matchesOfUser(userId: string) {
    return this.matches.filter((m) =>
      !m.winnerId && (m.p1Id === userId || m.p2Id === userId) &&
      this.tournaments.find((t) => t.id === m.tournamentId)?.status === "running");
  }
  async dueMatches(now: Date) {
    return this.matches.filter((m) =>
      !m.winnerId && m.p1Id && m.p2Id && m.readyAt &&
      m.readyAt.getTime() < now.getTime() - TOURNAMENT_WINDOW_MS &&
      this.tournaments.find((t) => t.id === m.tournamentId)?.status === "running");
  }
  async setMatchCheckin(matchId: number, col: "p1" | "p2") {
    const m = this.matches.find((x) => x.id === matchId);
    if (!m) return null;
    if (col === "p1") m.p1In = true; else m.p2In = true;
    return m;
  }
  async recordMatchResult(matchId: number, winnerId: string, result: string) {
    const m = this.matches.find((x) => x.id === matchId);
    if (!m || m.winnerId) return false;
    m.winnerId = winnerId;
    m.result = result;
    return true;
  }
  async advanceWinner(match: MatchRow, winnerId: string) {
    const t = this.tournaments.find((x) => x.id === match.tournamentId);
    if (!t) return "final" as const;
    const rounds = totalRounds(t.size);
    if (match.round >= rounds) return "final" as const;
    const nextSlot = Math.floor(match.slot / 2);
    let next = this.matches.find((m) =>
      m.tournamentId === match.tournamentId && m.round === match.round + 1 && m.slot === nextSlot);
    if (!next) {
      next = {
        id: this.matchSeq++, tournamentId: match.tournamentId, round: match.round + 1, slot: nextSlot,
        p1Id: null, p2Id: null, p1In: false, p2In: false, readyAt: null, winnerId: null, result: null,
      };
      this.matches.push(next);
    }
    if (match.slot % 2 === 0) next.p1Id = winnerId; else next.p2Id = winnerId;
    if (next.p1Id && next.p2Id && !next.readyAt) next.readyAt = new Date();
    return "advanced" as const;
  }
  async finishTournament(id: number, championId: string) {
    const t = this.tournaments.find((x) => x.id === id);
    if (t) {
      t.status = "done";
      t.championId = championId;
    }
  }
}

// ------------------------------------------------------------------
// Game service (rules, mirroring the web)
// ------------------------------------------------------------------

export interface SocialEconomyHooks {
  debit(userId: string, amount: number, source: string, note?: string): Promise<boolean>;
  credit(userId: string, amount: number, source: string, note?: string): Promise<void>;
  balance(userId: string): Promise<number>;
}

export interface SocialDeps {
  social: SocialStore;
  tcg: TcgStore;
  economy: SocialEconomyHooks;
  speciesMap: () => Promise<Map<string, TcgSpecies>>;
  feePercentFor: (userId: string) => Promise<number>;
  deckRules: () => Promise<DeckRules>;
  pricePerUsd: () => Promise<number>;
  onAction?: (userId: string, action: string, n: number) => Promise<void>;
}

export interface AuctionView extends AuctionRow {
  name: string;
  rarity: string;
  level: number;
  enhance: number;
  bids: number;
  minNext: number;
}

export interface ShowcaseCardView {
  code: string;
  name: string;
  rarity: string;
  level: number;
  enhance: number;
}

export interface TournamentView extends TournamentRow {
  entrants: number;
  joined: boolean;
}

export interface MatchView extends MatchRow {
  tournamentName: string;
  size: number;
  roundLabel: string;
}

type OpResult = { ok: true } | { ok: false; error: string };

const BASE_VALUE: Record<string, number> = {
  Common: 50, Uncommon: 150, Rare: 500, Epic: 2000,
  Legendary: 9000, Mythical: 20000, Fabled: 50000,
};

export class TcgSocialGame {
  constructor(private deps: SocialDeps) {}

  private async act(userId: string, action: string, n: number): Promise<void> {
    try {
      await this.deps.onAction?.(userId, action, n);
    } catch {
      /* quest hooks never break the flow */
    }
  }

  // ---------------- Showcase ----------------

  async showcaseView(viewerId: string, targetId: string): Promise<
    | { state: "none" }
    | { state: "private" }
    | { state: "ok"; layout: string; theme: string; effect: string; cards: ShowcaseCardView[] }
  > {
    const row = await this.deps.social.getShowcaseRow(targetId);
    if (!row || !row.owned) return { state: "none" };
    if (!row.isPublic && viewerId !== targetId) return { state: "private" };
    const species = await this.deps.speciesMap();
    const cards: ShowcaseCardView[] = [];
    for (const code of row.pins) {
      const inst = await this.deps.tcg.getInstance(code);
      if (!inst || inst.userId !== targetId) continue;
      const sp = species.get(inst.speciesId);
      cards.push({
        code, name: sp?.name ?? inst.speciesId, rarity: sp?.rarity ?? "Common",
        level: inst.level, enhance: inst.enhance,
      });
    }
    return { state: "ok", layout: row.layout, theme: row.theme, effect: row.effect, cards };
  }

  // ---------------- Auctions ----------------

  private async enrichAuction(a: AuctionRow): Promise<AuctionView> {
    const inst = await this.deps.tcg.getInstance(a.instanceCode);
    const species = await this.deps.speciesMap();
    const sp = inst ? species.get(inst.speciesId) : undefined;
    return {
      ...a,
      name: sp?.name ?? a.instanceCode,
      rarity: sp?.rarity ?? "Common",
      level: inst?.level ?? 1,
      enhance: inst?.enhance ?? 0,
      bids: await this.deps.social.countBids(a.id),
      minNext: minNextBid(a),
    };
  }

  private async payOutWonAuction(a: AuctionRow): Promise<void> {
    const price = a.currentPrice as number;
    const winner = a.topBidder as string;
    const feePct = await this.deps.feePercentFor(a.sellerId).catch(() => 5);
    const sellerGets = snapMoney(price - (price * feePct) / 100);
    if (sellerGets > 0) {
      await this.deps.economy.credit(a.sellerId, sellerGets, "auction", `Thắng đấu giá thẻ ${a.instanceCode}`);
    }
    await this.deps.tcg.updateInstance(a.instanceCode, { userId: winner });
    const inst = await this.deps.tcg.getInstance(a.instanceCode);
    const species = await this.deps.speciesMap();
    const sp = inst ? species.get(inst.speciesId) : undefined;
    if (inst && sp) {
      const rate = await this.deps.pricePerUsd().catch(() => 1);
      const seed = sp.priceUsd != null && sp.priceUsd > 0 ? sp.priceUsd * rate : (BASE_VALUE[sp.rarity] ?? 0);
      await this.deps.tcg.recordMarketSale(inst.speciesId, price, seed);
    }
  }

  /** Lazy settlement, exactly like the web: safe on any read. */
  async settleExpiredAuctions(): Promise<void> {
    const due = await this.deps.social.dueAuctions(new Date()).catch(() => [] as AuctionRow[]);
    for (const a of due) {
      const won = a.topBidder != null && a.currentPrice != null;
      const claimed = await this.deps.social
        .claimAuctionSettle(a.id, won ? "sold" : "unsold")
        .catch(() => null);
      if (claimed && won) await this.payOutWonAuction(claimed).catch(() => undefined);
    }
  }

  async listAuctions(): Promise<AuctionView[]> {
    await this.settleExpiredAuctions();
    const rows = await this.deps.social.listOpenAuctions();
    return Promise.all(rows.slice(0, 20).map((a) => this.enrichAuction(a)));
  }

  async myAuctions(userId: string): Promise<{ selling: AuctionView[]; bidding: AuctionView[] }> {
    await this.settleExpiredAuctions();
    const selling = await this.deps.social.auctionsOf(userId);
    const bidding = await this.deps.social.auctionsBidOn(userId);
    return {
      selling: await Promise.all(selling.slice(0, 15).map((a) => this.enrichAuction(a))),
      bidding: await Promise.all(bidding.slice(0, 15).map((a) => this.enrichAuction(a))),
    };
  }

  async createAuction(
    userId: string, code: string, startPrice: number, hours: number, buyNow: number | null,
  ): Promise<OpResult & { id?: number }> {
    if (!Number.isFinite(startPrice) || startPrice < AUCTION_MIN_START) {
      return { ok: false, error: `Giá khởi điểm tối thiểu ${AUCTION_MIN_START} Coins.` };
    }
    if (!(AUCTION_DURATIONS_HOURS as readonly number[]).includes(hours)) {
      return { ok: false, error: "Thời lượng phiên chỉ có thể là 1, 6, 24 hoặc 72 giờ." };
    }
    if (buyNow != null && (!Number.isFinite(buyNow) || buyNow <= startPrice)) {
      return { ok: false, error: "Giá mua ngay phải lớn hơn giá khởi điểm." };
    }
    const clean = code.trim().toUpperCase();
    const inst = await this.deps.tcg.getInstance(clean);
    if (!inst || inst.userId !== userId) return { ok: false, error: "Không tìm thấy thẻ đó trong kho của bạn." };
    if (inst.locked || inst.favorite) return { ok: false, error: "Thẻ khoá/yêu thích không đấu giá được." };
    const decks = await this.deps.tcg.listDecks(userId);
    if (decks.some((d: Deck) => d.codes.includes(clean))) {
      return { ok: false, error: "Thẻ đang trong bộ bài — gỡ ra trước khi đấu giá." };
    }
    const listing = await this.deps.tcg.listingForInstance(clean);
    if (listing && listing.status === "open") {
      return { ok: false, error: "Thẻ đang có tin bán trên chợ — huỷ tin trước." };
    }
    const open = await this.deps.social.listOpenAuctions();
    if (open.some((a) => a.instanceCode === clean)) {
      return { ok: false, error: "Thẻ đang ở trong một phiên đấu giá rồi." };
    }
    const row = await this.deps.social.insertAuction({
      sellerId: userId, instanceCode: clean, startPrice: snapMoney(startPrice),
      buyNowPrice: buyNow != null ? snapMoney(buyNow) : null,
      endsAt: new Date(Date.now() + hours * 3600 * 1000),
    });
    return { ok: true, id: row.id };
  }

  async placeBid(userId: string, auctionId: number, amount: number): Promise<OpResult> {
    if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Số tiền trả giá không hợp lệ." };
    amount = snapMoney(amount);
    await this.settleExpiredAuctions();
    const a = await this.deps.social.getAuction(auctionId);
    if (!a || a.status !== "open") return { ok: false, error: "Phiên đấu giá này không còn nữa." };
    if (a.endsAt.getTime() <= Date.now()) return { ok: false, error: "Phiên đã kết thúc." };
    if (a.sellerId === userId) return { ok: false, error: "Không tự trả giá phiên của mình được." };
    const min = minNextBid(a);
    if (amount < min) return { ok: false, error: `Giá tối thiểu lúc này là ${min} Coins.` };
    const prevTop = a.topBidder;
    const prevPrice = a.currentPrice;
    const selfRaise = prevTop === userId && prevPrice != null;
    const charge = selfRaise ? snapMoney(amount - (prevPrice as number)) : amount;
    const paid = await this.deps.economy.debit(userId, charge, "auction", `Trả giá phiên #${a.id} (giữ chỗ)`);
    if (!paid) return { ok: false, error: "Số dư Coins không đủ." };
    const newEndsAt = a.endsAt.getTime() - Date.now() < ANTI_SNIPE_MS
      ? new Date(Date.now() + ANTI_SNIPE_MS) : null;
    const applied = await this.deps.social.applyBid(a.id, prevTop, prevPrice, userId, amount, newEndsAt);
    if (!applied) {
      await this.deps.economy.credit(userId, charge, "auction", `Hoàn tiền trả giá phiên #${a.id} (phiên vừa đổi)`);
      return { ok: false, error: "Phiên vừa thay đổi — thử trả giá lại." };
    }
    await this.deps.social.addBidRecord(a.id, userId, amount);
    if (prevTop && prevTop !== userId && prevPrice != null) {
      await this.deps.economy.credit(prevTop, prevPrice, "auction", `Hoàn tiền bị vượt giá phiên #${a.id}`);
    }
    await this.act(userId, "auction_bid", 1);
    return { ok: true };
  }

  async buyNow(userId: string, auctionId: number): Promise<OpResult> {
    await this.settleExpiredAuctions();
    const a = await this.deps.social.getAuction(auctionId);
    if (!a || a.status !== "open") return { ok: false, error: "Phiên đấu giá này không còn nữa." };
    if (a.buyNowPrice == null) return { ok: false, error: "Phiên này không có giá mua ngay." };
    if (a.endsAt.getTime() <= Date.now()) return { ok: false, error: "Phiên đã kết thúc." };
    if (a.sellerId === userId) return { ok: false, error: "Không mua ngay phiên của chính mình được." };
    const price = a.buyNowPrice;
    const prevTop = a.topBidder;
    const prevPrice = a.currentPrice;
    const selfTop = prevTop === userId && prevPrice != null;
    const charge = selfTop ? snapMoney(price - (prevPrice as number)) : price;
    const paid = await this.deps.economy.debit(userId, charge, "auction", `Mua ngay phiên #${a.id}`);
    if (!paid) return { ok: false, error: "Số dư Coins không đủ." };
    const claimed = await this.deps.social.claimAuctionSold(a.id, userId, price);
    if (!claimed) {
      await this.deps.economy.credit(userId, charge, "auction", `Hoàn tiền mua ngay phiên #${a.id} (phiên vừa đổi)`);
      return { ok: false, error: "Phiên vừa thay đổi — thử lại sau." };
    }
    if (prevTop && prevTop !== userId && prevPrice != null) {
      await this.deps.economy.credit(prevTop, prevPrice, "auction", `Hoàn tiền bị mua ngay phiên #${a.id}`);
    }
    await this.payOutWonAuction(claimed);
    return { ok: true };
  }

  async cancelAuction(userId: string, auctionId: number): Promise<OpResult> {
    const a = await this.deps.social.getAuction(auctionId);
    if (!a || a.status !== "open") return { ok: false, error: "Phiên không còn mở nữa." };
    if (a.sellerId !== userId) return { ok: false, error: "Đây không phải phiên của bạn." };
    if (a.topBidder) return { ok: false, error: "Đã có người trả giá — không huỷ được nữa." };
    const done = await this.deps.social.cancelAuctionRow(a.id, userId);
    return done ? { ok: true } : { ok: false, error: "Phiên vừa thay đổi — thử lại sau." };
  }

  // ---------------- Tournaments ----------------

  async createTournament(ownerId: string, name: string, size: number, entryFee: number): Promise<OpResult & { id?: number }> {
    if (!(TOURNAMENT_SIZES as readonly number[]).includes(size)) {
      return { ok: false, error: "Số người của giải chỉ có thể là 8 hoặc 16." };
    }
    if (!Number.isFinite(entryFee) || entryFee < 0 || entryFee > 1_000_000) {
      return { ok: false, error: "Phí tham gia không hợp lệ." };
    }
    const row = await this.deps.social.insertTournament({
      name: name.trim().slice(0, 80) || "Giải đấu Puni",
      size, entryFee: snapMoney(entryFee), rakePercent: 10,
      prizeFirst: 50, prizeSecond: 30, prizeSemis: 20, createdBy: ownerId,
      edition: null,
    });
    return { ok: true, id: row.id };
  }

  async listTournaments(meId: string): Promise<TournamentView[]> {
    await this.settleTournamentTimeouts();
    const rows = await this.deps.social.listTournaments();
    const out: TournamentView[] = [];
    for (const t of rows.slice(0, 15)) {
      const entries = await this.deps.social.listEntries(t.id);
      out.push({ ...t, entrants: entries.length, joined: entries.some((e) => e.userId === meId) });
    }
    return out;
  }

  async tournamentDetail(id: number): Promise<{ t: TournamentRow; entries: EntryRow[]; matches: MatchRow[] } | null> {
    await this.settleTournamentTimeouts();
    const t = await this.deps.social.getTournament(id);
    if (!t) return null;
    return {
      t,
      entries: await this.deps.social.listEntries(id),
      matches: await this.deps.social.listMatches(id),
    };
  }

  async joinTournament(userId: string, tournamentId: number): Promise<OpResult> {
    await this.settleTournamentTimeouts();
    const t = await this.deps.social.getTournament(tournamentId);
    if (!t) return { ok: false, error: "Không tìm thấy giải đấu." };
    if (t.status !== "open") return { ok: false, error: "Giải này đã khoá đăng ký." };
    const entries = await this.deps.social.listEntries(t.id);
    if (entries.some((e) => e.userId === userId)) return { ok: false, error: "Bạn đã đăng ký giải này rồi." };
    if (entries.length >= t.size) return { ok: false, error: "Giải đã đủ người." };
    const decks = await this.deps.tcg.listDecks(userId);
    const active = decks.find((d: Deck) => d.isActive) ?? decks[0];
    if (!active) return { ok: false, error: "Bạn chưa có bộ bài nào — tạo bộ bài trước." };
    if (active.codes.length !== 30) {
      return { ok: false, error: `Bộ bài "${active.name}" có ${active.codes.length} thẻ — giải đấu cần bộ bài đúng 30 thẻ.` };
    }
    const mine = await this.deps.tcg.listInstances(userId);
    const byCode = new Map(mine.map((i: CardInstance) => [i.code, i] as const));
    const speciesIds: string[] = [];
    for (const code of active.codes) {
      const inst = byCode.get(code);
      if (!inst) return { ok: false, error: "Bộ bài đang dùng có thẻ không còn trong kho của bạn." };
      speciesIds.push(inst.speciesId);
    }
    const rules = await this.deps.deckRules();
    const errors = validateDeck(speciesIds, rules);
    if (errors.length) return { ok: false, error: `Bộ bài chưa hợp lệ: ${errors.join("; ")}.` };
    // Edition split (spec 6.38): the first entrant fixes the
    // tournament's edition; everyone else must match it.
    const myEdition = deckEdition(speciesIds);
    if (myEdition === "mixed") return { ok: false, error: "Bộ bài trộn hai bản Anh/Nhật — hãy dùng một bản duy nhất." };
    if (t.edition && t.edition !== myEdition) {
      return { ok: false, error: `Giải này dành cho bản ${t.edition === "jp" ? "Nhật" : "tiếng Anh"} — bộ bài của bạn là bản ${myEdition === "jp" ? "Nhật" : "tiếng Anh"}.` };
    }
    if (t.entryFee > 0) {
      const paid = await this.deps.economy.debit(userId, t.entryFee, "tournament", `Phí tham gia giải #${t.id}`);
      if (!paid) return { ok: false, error: "Số dư Coins không đủ trả phí tham gia." };
    }
    const inserted = await this.deps.social.insertEntryGuarded(t.id, userId, active.codes, t.size);
    if (!inserted) {
      if (t.entryFee > 0) {
        await this.deps.economy.credit(userId, t.entryFee, "tournament", `Hoàn phí giải #${t.id} (đăng ký không thành)`);
      }
      return { ok: false, error: "Giải vừa đủ người hoặc bạn đã đăng ký rồi." };
    }
    if (!t.edition) {
      // First entrant fixes the edition. If a simultaneous first
      // entrant of the other edition won the lock, roll this entry
      // back out and refund — editions never share a bracket.
      await this.deps.social.setTournamentEdition(t.id, myEdition);
      const fresh = await this.deps.social.getTournament(t.id);
      if (fresh?.edition && fresh.edition !== myEdition) {
        await this.deps.social.removeEntry(t.id, userId);
        if (t.entryFee > 0) {
          await this.deps.economy.credit(userId, t.entryFee, "tournament", `Hoàn phí giải #${t.id} (khác bản thẻ)`);
        }
        return { ok: false, error: "Giải vừa được người chơi khác chốt cho bản còn lại — đăng ký không thành, phí đã hoàn." };
      }
    }
    const now = await this.deps.social.listEntries(t.id);
    if (now.length >= t.size) await this.deps.social.lockBracket(t.id);
    return { ok: true };
  }

  async myMatches(userId: string): Promise<MatchView[]> {
    await this.settleTournamentTimeouts();
    const rows = await this.deps.social.matchesOfUser(userId);
    const out: MatchView[] = [];
    for (const m of rows) {
      const t = await this.deps.social.getTournament(m.tournamentId);
      out.push({
        ...m,
        tournamentName: t?.name ?? `Giải #${m.tournamentId}`,
        size: t?.size ?? 8,
        roundLabel: roundName(m.round, t?.size ?? 8),
      });
    }
    return out;
  }

  private async buildTeam(codes: string[]): Promise<BattleCardInput[]> {
    const species = await this.deps.speciesMap();
    const team: BattleCardInput[] = [];
    for (const code of codes.slice(0, 5)) {
      const inst = await this.deps.tcg.getInstance(code);
      if (!inst) continue;
      const sp = species.get(inst.speciesId);
      const stats = battleStatsFor(sp?.baseHp ?? 50, sp?.baseAtk ?? 50, inst.level, inst.enhance);
      team.push({ code, name: sp?.name ?? inst.speciesId, speciesId: inst.speciesId, ...stats });
    }
    return team;
  }

  /** Record a decided match, advance the winner, pay out on the final. */
  private async completeMatch(m: MatchRow, winnerId: string, result: string, log: string[]): Promise<boolean> {
    const recorded = await this.deps.social.recordMatchResult(m.id, winnerId, result, log);
    if (!recorded) return false;
    const step = await this.deps.social.advanceWinner(m, winnerId);
    if (step === "final") {
      const t = await this.deps.social.getTournament(m.tournamentId);
      if (t) {
        const pool = snapMoney(t.size * t.entryFee * (1 - t.rakePercent / 100));
        const loserId = m.p1Id === winnerId ? m.p2Id : m.p1Id;
        const matches = await this.deps.social.listMatches(t.id);
        const rounds = totalRounds(t.size);
        const semiLosers = matches
          .filter((x) => x.round === rounds - 1 && x.winnerId)
          .map((x) => (x.p1Id === x.winnerId ? x.p2Id : x.p1Id))
          .filter((x): x is string => typeof x === "string");
        const pay = async (userId: string | null, amount: number, note: string) => {
          if (userId && amount > 0) await this.deps.economy.credit(userId, snapMoney(amount), "tournament", note);
        };
        await pay(winnerId, (pool * t.prizeFirst) / 100, `Vô địch giải #${t.id}`);
        await pay(loserId, (pool * t.prizeSecond) / 100, `Á quân giải #${t.id}`);
        const semiEach = (pool * t.prizeSemis) / 100 / Math.max(1, semiLosers.length);
        for (const u of semiLosers) await pay(u, semiEach, `Bán kết giải #${t.id}`);
        await this.deps.social.finishTournament(t.id, winnerId);
      }
    }
    return true;
  }

  async playMatch(userId: string, matchId: number): Promise<OpResult & { winnerId?: string; log?: string[] }> {
    await this.settleTournamentTimeouts();
    const m = await this.deps.social.getMatch(matchId);
    if (!m) return { ok: false, error: "Không tìm thấy trận đấu." };
    if (m.winnerId) return { ok: false, error: "Trận này đã có kết quả." };
    if (m.p1Id !== userId && m.p2Id !== userId) return { ok: false, error: "Bạn không phải người chơi của trận này." };
    const t = await this.deps.social.getTournament(m.tournamentId);
    if (!t || t.status !== "running") return { ok: false, error: "Giải đấu không còn đang chạy." };
    if (m.readyAt && m.readyAt.getTime() < Date.now() - TOURNAMENT_WINDOW_MS) {
      return { ok: false, error: "Đã quá 10 phút — trận được xử theo luật walkover." };
    }
    const updated = await this.deps.social.setMatchCheckin(m.id, m.p1Id === userId ? "p1" : "p2");
    if (!updated) return { ok: false, error: "Không tìm thấy trận đấu." };
    if (!(updated.p1In && updated.p2In)) {
      return { ok: true }; // checked in, waiting for the opponent
    }
    const entries = await this.deps.social.listEntries(m.tournamentId);
    const deckOf = new Map(entries.map((e) => [e.userId, e.deckCodes] as const));
    const teamA = await this.buildTeam(deckOf.get(m.p1Id ?? "") ?? []);
    const teamB = await this.buildTeam(deckOf.get(m.p2Id ?? "") ?? []);
    let winnerId: string;
    let result: string;
    let log: string[];
    if (teamA.length < 5 || teamB.length < 5) {
      winnerId = teamA.length >= 5 ? (m.p1Id as string) : (m.p2Id as string);
      result = "walkover";
      log = ["Một bên không còn đủ 5 thẻ hợp lệ trong bộ bài đã đăng ký — xử thắng cho đối thủ."];
    } else {
      const sim = simulateCardBattle(teamA, teamB, rngFromSeed(m.id * 31 + 7));
      winnerId = sim.winner === "a" ? (m.p1Id as string) : (m.p2Id as string);
      result = "battle";
      log = sim.log.slice(0, 200);
    }
    await this.completeMatch(m, winnerId, result, log);
    return { ok: true, winnerId, log };
  }

  /** Lazy walkover settlement, mirroring the web. Best-effort. */
  async settleTournamentTimeouts(): Promise<void> {
    const due = await this.deps.social.dueMatches(new Date()).catch(() => [] as MatchRow[]);
    for (const m of due) {
      try {
        let winnerId: string;
        let result: string;
        if (m.p1In !== m.p2In) {
          winnerId = m.p1In ? (m.p1Id as string) : (m.p2Id as string);
          result = "walkover";
        } else {
          const entries = await this.deps.social.listEntries(m.tournamentId);
          const seedOf = new Map(entries.map((e) => [e.userId, e.seed ?? 99] as const));
          winnerId = (seedOf.get(m.p1Id ?? "") ?? 99) <= (seedOf.get(m.p2Id ?? "") ?? 99)
            ? (m.p1Id as string) : (m.p2Id as string);
          result = "double-walkover";
        }
        await this.completeMatch(m, winnerId, result, ["Quá 10 phút không đấu — xử thua theo luật walkover."]);
      } catch {
        /* best-effort per read; the next read retries */
      }
    }
  }
}
