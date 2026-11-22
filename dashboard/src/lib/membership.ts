/**
 * Mirror of the bot's membership tier contract (spec 6.19). Tier
 * definitions live in bot_config 'membership_tiers' and are edited in
 * the Admin panel; the bot normalizes again on read, so this mirror
 * only needs to be shape-compatible.
 */
export interface MembershipTier {
  id: string;
  name: string;
  priceLabel: string;
  /** Numeric VNĐ price for the payment QR; 0 = not sold online. */
  priceAmount: number;
  dailyBonusPercent: number;
  extraTeams: number;
  extraLootboxPerDay: number;
  exclusivePets: boolean;
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
      "Vote trên top.gg nhận gấp đôi tiền thưởng",
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
      "Vote trên top.gg nhận gấp đôi tiền thưởng",
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

export function normalizeMembershipTiers(raw: unknown): MembershipTier[] {
  if (!Array.isArray(raw)) return DEFAULT_MEMBERSHIP_TIERS.map((t) => ({ ...t }));
  const seen = new Set<string>();
  const out: MembershipTier[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const name = typeof r.name === "string" ? r.name.trim().slice(0, 40) : "";
    if (!name) continue;
    let id = typeof r.id === "string" ? r.id.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 32) : "";
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
