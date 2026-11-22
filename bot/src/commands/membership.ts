/**
 * Membership command — spec 6.19. `pass` shows the caller's current
 * tier + expiry, or the tier catalogue when they hold none. Tier
 * definitions come from the owner-edited config (Admin panel), read
 * live through the injected source.
 */
import type { CommandDef } from "@puni/shared";
import {
  effectivePerks,
  type MembershipOrderStore,
  type MembershipStore,
  type MembershipTier,
} from "../services/membership";

const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "Đang chờ thanh toán",
  paid: "Đã thanh toán",
  cancelled: "Đã huỷ",
};

export function createMembershipCommands(deps: {
  membership: MembershipStore;
  tiersSource: () => Promise<MembershipTier[]>;
  orders?: MembershipOrderStore;
}): CommandDef[] {
  const pass: CommandDef = {
    name: "pass",
    aliases: ["membership", "hoivien"],
    description: "Xem gói hội viên Puni của bạn và các gói đang mở",
    module: "economy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const tiers = await deps.tiersSource().catch(() => []);
      const active = await deps.membership
        .getActive(ctx.userId, new Date())
        .catch(() => null);
      if (active) {
        const perks = effectivePerks(tiers, active.tierId);
        const tierName = perks?.tier.name ?? active.tierId;
        const expiry = active.expiresAt.toLocaleDateString("vi-VN");
        const lines = [
          `Bạn đang là hội viên **${tierName}** — còn hạn đến **${expiry}**.`,
        ];
        if (perks && perks.dailyBonusPercent > 0) {
          lines.push(`Quyền lợi đang áp dụng: daily +${perks.dailyBonusPercent}%.`);
        }
        if (perks?.tier.perks.length) {
          lines.push(...perks.tier.perks.map((x) => `· ${x}`));
        }
        return { text: lines.join("\n") };
      }
      if (tiers.length === 0) {
        return { text: "Hiện chưa có gói hội viên nào đang mở." };
      }
      const lines = ["Bạn chưa có gói hội viên. Các gói đang mở:"];
      for (const t of tiers) {
        lines.push(
          `· **${t.name}**${t.priceLabel ? ` — ${t.priceLabel}` : ""}: daily +${t.dailyBonusPercent}%`,
        );
      }
      lines.push("Xem chi tiết và đăng ký tại trang Hội viên trên website của Puni nhé!");
      return { text: lines.join("\n") };
    },
  };
  const orders: CommandDef = {
    name: "orders",
    aliases: ["lichsu", "donhang"],
    description: "Xem lịch sử mua gói hội viên của bạn",
    module: "economy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      if (!deps.orders) {
        return { text: "Lịch sử mua chưa khả dụng trên hệ thống này." };
      }
      const rows = await deps.orders.listByUser(ctx.userId, 10).catch(() => []);
      if (rows.length === 0) {
        return {
          text: "Bạn chưa có đơn mua gói hội viên nào. Xem các gói ở trang Hội viên trên website của Puni nhé!",
        };
      }
      const fmtVnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
      const lines = ["Lịch sử mua gói hội viên của bạn:"];
      for (const o of rows) {
        // Pending orders older than 24h are shown as expired.
        const expired =
          o.status === "pending" && Date.now() - o.createdAt.getTime() > 24 * 3_600_000;
        const label = expired ? "Đã hết hạn" : (ORDER_STATUS_LABEL[o.status] ?? o.status);
        lines.push(
          `· ${o.code} — ${o.tierName} — ${fmtVnd(o.amount)} — ${label} — ${o.createdAt.toLocaleDateString("vi-VN")}`,
        );
      }
      return { text: lines.join("\n") };
    },
  };
  return [pass, orders];
}
