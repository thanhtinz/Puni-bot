/**
 * Marriage system (spec 6.16.5): global by Discord ID. Rings are
 * bought with Coins in 7 tiers (prices ×10, owner-editable via
 * bot_config); a ring is consumed only when a proposal is ACCEPTED.
 * Married couples who BOTH claim daily on the same day each receive
 * a TCG gift (a standard pack or 20 shards — spec 6.25 conversion).
 */

export interface RingTier {
  tier: number;
  name: string;
  price: number;
}

export const DEFAULT_RING_TIERS: RingTier[] = [
  { tier: 1, name: "Nhẫn Vàng Trơn", price: 10 },
  { tier: 2, name: "Nhẫn Bạc Lam Ngọc", price: 100 },
  { tier: 3, name: "Nhẫn Trái Tim Hồng", price: 1_000 },
  { tier: 4, name: "Nhẫn Vô Cực Lam", price: 10_000 },
  { tier: 5, name: "Nhẫn Hoa Lá", price: 100_000 },
  { tier: 6, name: "Nhẫn Sao Trời", price: 1_000_000 },
  { tier: 7, name: "Nhẫn Kim Cương", price: 10_000_000 },
];

export function normalizeRingTiers(raw: unknown): RingTier[] {
  if (!Array.isArray(raw)) return DEFAULT_RING_TIERS.map((r) => ({ ...r }));
  const out: RingTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const tier = Number.parseInt(String(r.tier ?? ""), 10);
    const price = Number.parseInt(String(r.price ?? ""), 10);
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 60) : "";
    if (!Number.isInteger(tier) || tier < 1 || tier > 7 || !name) continue;
    if (!Number.isFinite(price) || price < 0) continue;
    if (out.some((x) => x.tier === tier)) continue;
    out.push({ tier, name, price });
  }
  return out.length ? out.sort((a, b) => a.tier - b.tier) : DEFAULT_RING_TIERS.map((r) => ({ ...r }));
}

export interface Marriage {
  partnerId: string;
  ringTier: number;
  marriedAt: Date;
}

export interface Proposal {
  id: number;
  fromUser: string;
  toUser: string;
  ringTier: number;
  status: "pending" | "accepted" | "rejected" | "expired";
  createdAt: Date;
  expiresAt: Date;
}

export const PROPOSAL_TTL_MS = 24 * 60 * 60 * 1000;

export interface MarriageStore {
  getMarriage(userId: string): Promise<Marriage | null>;
  createMarriage(a: string, b: string, ringTier: number): Promise<void>;
  setRingTier(a: string, b: string, ringTier: number): Promise<void>;
  deleteMarriage(userId: string): Promise<void>;
  ringQty(userId: string, tier: number): Promise<number>;
  adjustRing(userId: string, tier: number, delta: number): Promise<number>;
  createProposal(fromUser: string, toUser: string, ringTier: number, now: Date): Promise<Proposal>;
  pendingProposalFor(toUser: string): Promise<Proposal | null>;
  pendingProposalFrom(fromUser: string): Promise<Proposal | null>;
  resolveProposal(id: number, status: Proposal["status"]): Promise<void>;
  /** Record a spouse's daily claim; returns true when this claim
   *  completes the couple for the day and the gift was not yet given. */
  recordCoupleDaily(userId: string, partnerId: string, day: string): Promise<boolean>;
  markCoupleGifted(userId: string, partnerId: string, day: string): Promise<void>;
}

export class InMemoryMarriageStore implements MarriageStore {
  private marriages = new Map<string, Marriage>(); // keyed by each partner
  private rings = new Map<string, number>(); // userId:tier -> qty
  private proposals: Proposal[] = [];
  private coupleDaily = new Map<string, { claimed: boolean; gifted: boolean }>(); // userId:day

  async getMarriage(userId: string) {
    const m = this.marriages.get(userId);
    return m ? { ...m } : null;
  }
  async createMarriage(a: string, b: string, ringTier: number) {
    const at = new Date();
    this.marriages.set(a, { partnerId: b, ringTier, marriedAt: at });
    this.marriages.set(b, { partnerId: a, ringTier, marriedAt: at });
  }
  async setRingTier(a: string, b: string, ringTier: number) {
    const ma = this.marriages.get(a);
    const mb = this.marriages.get(b);
    if (ma) ma.ringTier = ringTier;
    if (mb) mb.ringTier = ringTier;
  }
  async deleteMarriage(userId: string) {
    const m = this.marriages.get(userId);
    if (m) this.marriages.delete(m.partnerId);
    this.marriages.delete(userId);
  }
  async ringQty(userId: string, tier: number) {
    return this.rings.get(`${userId}:${tier}`) ?? 0;
  }
  async adjustRing(userId: string, tier: number, delta: number) {
    const k = `${userId}:${tier}`;
    const next = Math.max(0, (this.rings.get(k) ?? 0) + delta);
    this.rings.set(k, next);
    return next;
  }
  async createProposal(fromUser: string, toUser: string, ringTier: number, now: Date) {
    const p: Proposal = {
      id: this.proposals.length + 1,
      fromUser, toUser, ringTier,
      status: "pending",
      createdAt: now,
      expiresAt: new Date(now.getTime() + PROPOSAL_TTL_MS),
    };
    this.proposals.push(p);
    return { ...p };
  }
  async pendingProposalFor(toUser: string) {
    const p = [...this.proposals].reverse().find((x) => x.toUser === toUser && x.status === "pending");
    return p ? { ...p } : null;
  }
  async pendingProposalFrom(fromUser: string) {
    const p = [...this.proposals].reverse().find((x) => x.fromUser === fromUser && x.status === "pending");
    return p ? { ...p } : null;
  }
  async resolveProposal(id: number, status: Proposal["status"]) {
    const p = this.proposals.find((x) => x.id === id);
    if (p && p.status === "pending") p.status = status;
  }
  async recordCoupleDaily(userId: string, partnerId: string, day: string) {
    const mine = this.coupleDaily.get(`${userId}:${day}`) ?? { claimed: false, gifted: false };
    mine.claimed = true;
    this.coupleDaily.set(`${userId}:${day}`, mine);
    const theirs = this.coupleDaily.get(`${partnerId}:${day}`);
    return Boolean(theirs?.claimed) && !mine.gifted && !theirs?.gifted;
  }
  async markCoupleGifted(userId: string, partnerId: string, day: string) {
    for (const u of [userId, partnerId]) {
      const e = this.coupleDaily.get(`${u}:${day}`) ?? { claimed: true, gifted: false };
      e.gifted = true;
      this.coupleDaily.set(`${u}:${day}`, e);
    }
  }
}

/**
 * Couple daily gift (spec 6.25): when both spouses claimed daily the
 * same day, each gets ONE gift — a standard TCG pack or 20 shards,
 * chosen per couple per day by a stable hash so both sides agree.
 */
export function coupleGiftFor(a: string, b: string, day: string): "pack" | "shards" {
  const s = `${a}|${b}|${day}`;
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 2 === 0 ? "pack" : "shards";
}
