/**
 * Mirror of the bot's membership tier contract (spec 6.19). Tier
 * definitions live in bot_config 'membership_tiers' and are edited in
 * the Admin panel; the bot normalizes again on read, so this mirror
 * only needs to be shape-compatible.
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
  /** Extra saved deck slots in the TCG. */
  extraTeams: number;
  /** Legacy field, unused since the game became TCG-only. */
  extraLootboxPerDay: number;
  /** Unlocks member-exclusive cards in the TCG (GĐ9 reads this). */
  exclusivePets: boolean;
  /** % off TCG gacha pull costs (0..90). */
  gachaDiscountPercent: number;
  /** Market sale fee % for this member (base fee is the TCG config's
   *  marketFeePercent, default 5; lower = better, 0..5). */
  marketFeePercent: number;
  /** % added on top of card-battle Coin rewards (0..100). */
  battleBonusPercent: number;
  /** % added on top of card-battle card XP (0..100). */
  xpBonusPercent: number;
  /** Extra free standard packs from the daily TCG claim (0..3). */
  extraFreePacksPerDay: number;
  /** Display perk lines for /membership and the `pass` command. */
  perks: string[];
}

export const DEFAULT_MEMBERSHIP_TIERS: MembershipTier[] = [
  {
    id: "free",
    name: "Free",
    priceLabel: "Miễn phí",
    priceAmount: 0,
    dailyBonusPercent: 0,
    extraTeams: 0,
    extraLootboxPerDay: 0,
    exclusivePets: false,
    gachaDiscountPercent: 0,
    marketFeePercent: 5,
    battleBonusPercent: 0,
    xpBonusPercent: 0,
    extraFreePacksPerDay: 0,
    perks: [
      "Mở pack miễn phí mỗi ngày",
      "Sưu tập và trao đổi thẻ",
      "Đấu bài, nhiệm vụ, leaderboard",
      "Marketplace cơ bản",
    ],
  },
  {
    id: "vip",
    name: "VIP",
    priceLabel: "50.000đ/tháng",
    priceAmount: 50000,
    dailyBonusPercent: 50,
    extraTeams: 1,
    extraLootboxPerDay: 0,
    exclusivePets: false,
    gachaDiscountPercent: 0,
    marketFeePercent: 5,
    battleBonusPercent: 0,
    xpBonusPercent: 0,
    extraFreePacksPerDay: 0,
    perks: [
      "Mọi quyền lợi gói Free",
      "Bonus đăng nhập: daily +50% Coins",
      "Profile frame VIP",
      "Thêm 1 slot deck",
      "Nhiệm vụ VIP",
      "Tiện ích sưu tập dành cho VIP",
    ],
  },
  {
    id: "premium",
    name: "Premium",
    priceLabel: "200.000đ/tháng",
    priceAmount: 200000,
    dailyBonusPercent: 100,
    extraTeams: 2,
    extraLootboxPerDay: 0,
    exclusivePets: false,
    gachaDiscountPercent: 0,
    marketFeePercent: 5,
    battleBonusPercent: 0,
    xpBonusPercent: 0,
    extraFreePacksPerDay: 0,
    perks: [
      "Tất cả quyền lợi VIP",
      "Bonus đăng nhập: daily +100% Coins",
      "Thêm slot deck và bộ sưu tập",
      "Profile tùy chỉnh nâng cao",
      "Thống kê chiến đấu",
      "Quản lý giao dịch nâng cao",
    ],
  },
];

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "number" ? Math.floor(v) : Number.parseInt(String(v ?? ""), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
}


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
      gachaDiscountPercent: clampInt(r.gachaDiscountPercent, 0, 90, 0),
      marketFeePercent: clampInt(r.marketFeePercent, 0, 5, 5),
      battleBonusPercent: clampInt(r.battleBonusPercent, 0, 100, 0),
      xpBonusPercent: clampInt(r.xpBonusPercent, 0, 100, 0),
      extraFreePacksPerDay: clampInt(r.extraFreePacksPerDay, 0, 3, 0),
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

export interface EffectivePerks {
  tier: MembershipTier;
  dailyBonusPercent: number;
  extraTeams: number;
  extraLootboxPerDay: number;
  exclusivePets: boolean;
  gachaDiscountPercent: number;
  marketFeePercent: number;
  battleBonusPercent: number;
  xpBonusPercent: number;
  extraFreePacksPerDay: number;
}

export function effectivePerksWeb(
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
    gachaDiscountPercent: tiers[idx].gachaDiscountPercent,
    marketFeePercent: Math.min(...upto.map((t) => t.marketFeePercent)),
    battleBonusPercent: tiers[idx].battleBonusPercent,
    xpBonusPercent: tiers[idx].xpBonusPercent,
    extraFreePacksPerDay: Math.max(...upto.map((t) => t.extraFreePacksPerDay)),
  };
}
