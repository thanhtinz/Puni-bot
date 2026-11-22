/**
 * Membership (spec 6.19) — paid supporter tiers for the whole bot.
 * Tier DEFINITIONS are owner-edited in the Admin panel (bot_config
 * 'membership_tiers'); nothing about names/prices/perks is hardcoded
 * here beyond the seed defaults below. Membership itself is GLOBAL per
 * Discord user id, like the economy. Perks are cumulative: a member
 * enjoys the mechanisms of every tier up to their own.
 */

export interface MembershipTier {
  id: string;
  name: string;
  /** Free-text display price, e.g. "25.000đ/tháng" — display only. */
  priceLabel: string;
  /** Numeric price in VNĐ used to build the payment QR (spec 6.19
   *  purchase flow). 0 = not sold online (contact only). */
  priceAmount: number;
  /** Percent added on top of the daily payout (0..300). */
  dailyBonusPercent: number;
  /** Extra saved team slots in the game (GĐ9 reads this). */
  extraTeams: number;
  /** Extra daily lootbox allowance in the game (GĐ9 reads this). */
  extraLootboxPerDay: number;
  /** Unlocks member-exclusive pets in the game (GĐ9 reads this). */
  exclusivePets: boolean;
  /** Display perk lines for /membership and the `pass` command. */
  perks: string[];
}

export const DEFAULT_MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: "dong-hanh",
    name: "Bạn đồng hành",
    priceLabel: "25.000đ/tháng",
    priceAmount: 25000,
    dailyBonusPercent: 25,
    extraTeams: 0,
    extraLootboxPerDay: 0,
    exclusivePets: true,
    perks: [
      "Daily nhận thêm +25% tiền",
      "Mở khoá pet độc quyền dành cho hội viên",
      "Câu cá: trần tiền mỗi ngày x2, thời gian chờ giảm nửa",
      "Huy hiệu hội viên trong hồ sơ",
      "Role màu hội viên trong server chính của Puni",
    ],
  },
  {
    id: "ung-ho",
    name: "Người ủng hộ",
    priceLabel: "50.000đ/tháng",
    priceAmount: 50000,
    dailyBonusPercent: 50,
    extraTeams: 1,
    extraLootboxPerDay: 0,
    exclusivePets: true,
    perks: [
      "Daily nhận thêm +50% tiền",
      "Thêm 1 đội hình lưu sẵn trong game",
      "Mở khoá pet độc quyền dành cho hội viên",
    ],
  },
  {
    id: "hao-tam",
    name: "Hảo tâm",
    priceLabel: "100.000đ/tháng",
    priceAmount: 100000,
    dailyBonusPercent: 100,
    extraTeams: 2,
    extraLootboxPerDay: 1,
    exclusivePets: true,
    perks: [
      "Daily nhận thêm +100% tiền (gấp đôi)",
      "Thêm 2 đội hình lưu sẵn trong game",
      "Thêm 1 lootbox mỗi ngày trong game",
      "Huy hiệu đặc biệt trên thẻ profile game",
      "Thiết kế 1 pet riêng theo yêu cầu của bạn (liên hệ chủ bot)",
      "Được yêu cầu tuỳ biến 1 lệnh theo ý bạn (liên hệ chủ bot)",
    ],
  },
];

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.floor(v) : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}

/** Normalize whatever the Admin panel saved into safe tier definitions.
 *  Invalid rows are dropped; at most 4 tiers; ids are slugified and
 *  de-duplicated. */
export function normalizeMembershipTiers(raw: unknown): MembershipTier[] {
  if (!Array.isArray(raw)) return DEFAULT_MEMBERSHIP_TIERS.map((t) => ({ ...t }));
  const seen = new Set<string>();
  const out: MembershipTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 40) : "";
    if (!name) continue;
    let id =
      typeof r.id === "string"
        ? r.id.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32)
        : "";
    if (!id) id = `tier-${out.length + 1}`;
    if (seen.has(id)) id = `${id}-${out.length + 1}`;
    seen.add(id);
    out.push({
      id,
      name,
      priceLabel: typeof r.priceLabel === "string" ? r.priceLabel.trim().slice(0, 40) : "",
      priceAmount: clampInt(r.priceAmount, 0, 100_000_000, 0),
      dailyBonusPercent: clampInt(r.dailyBonusPercent, 0, 300, 0),
      extraTeams: clampInt(r.extraTeams, 0, 5, 0),
      extraLootboxPerDay: clampInt(r.extraLootboxPerDay, 0, 5, 0),
      exclusivePets: r.exclusivePets === true,
      perks: Array.isArray(r.perks)
        ? r.perks
            .filter((x): x is string => typeof x === "string")
            .map((x) => x.trim().slice(0, 120))
            .filter(Boolean)
            .slice(0, 8)
        : [],
    });
    if (out.length >= 4) break;
  }
  return out;
}

export interface MembershipRecord {
  userId: string;
  tierId: string;
  startedAt: Date;
  expiresAt: Date;
  source: string;
  note: string;
}

export interface EffectivePerks {
  tier: MembershipTier;
  dailyBonusPercent: number;
  extraTeams: number;
  extraLootboxPerDay: number;
  exclusivePets: boolean;
}

/** Cumulative perks for a member of `tierId`: numeric game allowances
 *  take the best value among their tier and all tiers below it; the
 *  daily percent is their own tier's (tiers are priced ascending). */
export function effectivePerks(
  tiers: MembershipTier[],
  tierId: string,
): EffectivePerks | null {
  const idx = tiers.findIndex((t) => t.id === tierId);
  if (idx < 0) return null;
  const upto = tiers.slice(0, idx + 1);
  return {
    tier: tiers[idx],
    dailyBonusPercent: tiers[idx].dailyBonusPercent,
    extraTeams: Math.max(...upto.map((t) => t.extraTeams)),
    extraLootboxPerDay: Math.max(...upto.map((t) => t.extraLootboxPerDay)),
    exclusivePets: upto.some((t) => t.exclusivePets),
  };
}

export interface MembershipStore {
  /** The user's record when it exists AND has not expired at `at`. */
  getActive(userId: string, at: Date): Promise<MembershipRecord | null>;
  /** Grant or extend: expiry stacks from the later of now / current
   *  expiry, so renewing early never loses paid time. */
  grant(input: {
    userId: string;
    tierId: string;
    days: number;
    source: string;
    note: string;
    at: Date;
  }): Promise<MembershipRecord>;
  revoke(userId: string): Promise<void>;
  /** Every record, including expired ones (role sync, spec 6.19). */
  listAll(): Promise<MembershipRecord[]>;
}

export class InMemoryMembershipStore implements MembershipStore {
  private records = new Map<string, MembershipRecord>();

  async getActive(userId: string, at: Date): Promise<MembershipRecord | null> {
    const rec = this.records.get(userId);
    if (!rec || rec.expiresAt.getTime() <= at.getTime()) return null;
    return rec;
  }

  async grant(input: {
    userId: string;
    tierId: string;
    days: number;
    source: string;
    note: string;
    at: Date;
  }): Promise<MembershipRecord> {
    const existing = this.records.get(input.userId);
    const base =
      existing && existing.expiresAt.getTime() > input.at.getTime()
        ? existing.expiresAt
        : input.at;
    const rec: MembershipRecord = {
      userId: input.userId,
      tierId: input.tierId,
      startedAt: existing && existing.tierId === input.tierId ? existing.startedAt : input.at,
      expiresAt: new Date(base.getTime() + input.days * 86_400_000),
      source: input.source,
      note: input.note,
    };
    this.records.set(input.userId, rec);
    return rec;
  }

  async revoke(userId: string): Promise<void> {
    this.records.delete(userId);
  }

  async listAll(): Promise<MembershipRecord[]> {
    return [...this.records.values()];
  }
}


export type MembershipOrderStatus = "pending" | "paid" | "cancelled";

export interface MembershipOrder {
  code: string;
  userId: string;
  tierId: string;
  tierName: string;
  amount: number;
  days: number;
  status: MembershipOrderStatus;
  createdAt: Date;
  paidAt: Date | null;
}

export interface MembershipOrderStore {
  listByUser(userId: string, limit: number): Promise<MembershipOrder[]>;
}

export class InMemoryMembershipOrderStore implements MembershipOrderStore {
  private orders: MembershipOrder[] = [];

  add(order: MembershipOrder): void {
    this.orders.push(order);
  }

  async listByUser(userId: string, limit: number): Promise<MembershipOrder[]> {
    return this.orders
      .filter((o) => o.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, limit);
  }
}
