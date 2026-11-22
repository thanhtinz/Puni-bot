/**
 * Marriage commands (spec 6.16.5): one `marry` command —
 *   marry                → status + ring shop summary
 *   marry rings          → ring tiers and prices
 *   marry buy <1-7>      → buy a ring with Coins
 *   marry @user          → propose with your best owned ring
 *   marry accept/reject  → answer a pending proposal
 *   marry divorce        → (then `marry divorce confirm`) end it
 * Rings are consumed ONLY when a proposal is accepted. Proposing to
 * your own spouse with a higher ring = ring upgrade.
 */
import type { CommandDef } from "@puni/shared";
import {
  coupleGiftFor,
  type MarriageStore,
  type RingTier,
} from "../services/marriage";
import type { TcgStore } from "../services/tcg-store";

export interface MarriageEconomyHooks {
  debit(userId: string, amount: number, source: string, note?: string): Promise<boolean>;
  credit(userId: string, amount: number, source: string, note?: string): Promise<void>;
}

const fmt = (n: number) => n.toLocaleString("vi-VN");

export function createMarriageCommands(deps: {
  store: MarriageStore;
  economy: MarriageEconomyHooks;
  ringTiers: () => Promise<RingTier[]>;
  currencyName: () => string;
  now?: () => Date;
}): CommandDef[] {
  const now = () => (deps.now ? deps.now() : new Date());

  const statusText = async (userId: string): Promise<string> => {
    const tiers = await deps.ringTiers();
    const m = await deps.store.getMarriage(userId);
    const owned: string[] = [];
    for (const t of tiers) {
      const q = await deps.store.ringQty(userId, t.tier);
      if (q > 0) owned.push(`${t.name} ×${q}`);
    }
    if (m) {
      const ring = tiers.find((t) => t.tier === m.ringTier);
      return (
        `<@${userId}> đang kết hôn với <@${m.partnerId}> bằng **${ring?.name ?? "nhẫn"}** ` +
        `từ ${m.marriedAt.toLocaleDateString("vi-VN")}.` +
        (owned.length ? `\nNhẫn đang có: ${owned.join(", ")}` : "") +
        `\nCả hai cùng nhận daily trong ngày thì mỗi người được thêm 1 quà TCG (gói thẻ hoặc mảnh thẻ).`
      );
    }
    return (
      `<@${userId}> chưa kết hôn.` +
      (owned.length ? `\nNhẫn đang có: ${owned.join(", ")}` : "\nBạn chưa có nhẫn nào — mua bằng `marry buy <bậc 1-7>`.") +
      `\nCầu hôn bằng \`marry @người ấy\`.`
    );
  };

  const marry: CommandDef = {
    name: "marry",
    aliases: ["cuoi", "kethon"],
    description: "Hôn nhân: marry buy <bậc> mua nhẫn · marry @người cầu hôn · accept/reject · divorce",
    module: "economy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 3,
    handler: async (ctx) => {
      const sub = (ctx.args[0] ?? "").toLowerCase();
      const tiers = await deps.ringTiers();

      if (sub === "rings") {
        return {
          text: [
            "**Nhẫn cưới** (mua bằng " + deps.currencyName() + "):",
            ...tiers.map((t) => `${t.tier}. **${t.name}** — ${fmt(t.price)} ${deps.currencyName()}`),
            "Nhẫn đắt chỉ để thể diện — quyền lợi vợ chồng như nhau. Mua: `marry buy <bậc>`.",
          ].join("\n"),
          ephemeral: true,
        };
      }

      if (sub === "buy") {
        const tierNo = Number.parseInt(ctx.args[1] ?? "", 10);
        const tier = tiers.find((t) => t.tier === tierNo);
        if (!tier) return { text: "Chọn bậc nhẫn từ 1 đến 7 — xem `marry rings`." };
        const ok = await deps.economy.debit(ctx.userId, tier.price, "marriage", `Mua ${tier.name}`);
        if (!ok) return { text: `Không đủ ${deps.currencyName()} — ${tier.name} giá ${fmt(tier.price)}.` };
        const qty = await deps.store.adjustRing(ctx.userId, tier.tier, 1);
        return { text: `Đã mua **${tier.name}** (đang có ×${qty}). Cầu hôn bằng \`marry @người ấy\`.` };
      }

      if (sub === "accept" || sub === "reject") {
        const p = await deps.store.pendingProposalFor(ctx.userId);
        if (!p) return { text: "Bạn không có lời cầu hôn nào đang chờ." };
        if (p.expiresAt.getTime() < now().getTime()) {
          await deps.store.resolveProposal(p.id, "expired");
          return { text: "Lời cầu hôn đó đã hết hạn rồi." };
        }
        if (sub === "reject") {
          await deps.store.resolveProposal(p.id, "rejected");
          return { text: `Đã từ chối lời cầu hôn của <@${p.fromUser}>. Nhẫn vẫn thuộc về người ấy.` };
        }
        // Accept: re-validate both sides (layered checks).
        const mine = await deps.store.getMarriage(ctx.userId);
        const theirs = await deps.store.getMarriage(p.fromUser);
        const isUpgrade = mine?.partnerId === p.fromUser && theirs?.partnerId === ctx.userId;
        if (mine && !isUpgrade) return { text: "Bạn đã kết hôn rồi — không nhận thêm được." };
        if (theirs && !isUpgrade) return { text: "Người ấy đã kết hôn với người khác rồi." };
        if (isUpgrade && p.ringTier <= (mine?.ringTier ?? 0)) {
          return { text: "Nhẫn mới phải cao cấp hơn nhẫn hiện tại mới nâng cấp được." };
        }
        const qty = await deps.store.ringQty(p.fromUser, p.ringTier);
        if (qty <= 0) {
          await deps.store.resolveProposal(p.id, "rejected");
          return { text: "Người ấy không còn chiếc nhẫn đó nữa — lời cầu hôn đã huỷ." };
        }
        await deps.store.adjustRing(p.fromUser, p.ringTier, -1);
        if (isUpgrade) {
          await deps.store.setRingTier(ctx.userId, p.fromUser, p.ringTier);
        } else {
          await deps.store.createMarriage(p.fromUser, ctx.userId, p.ringTier);
        }
        await deps.store.resolveProposal(p.id, "accepted");
        const ring = tiers.find((t) => t.tier === p.ringTier);
        return {
          text: isUpgrade
            ? `**Nâng cấp nhẫn thành công!** <@${p.fromUser}> và <@${ctx.userId}> giờ đeo **${ring?.name}**.`
            : `**Chúc mừng!** <@${p.fromUser}> và <@${ctx.userId}> đã kết hôn bằng **${ring?.name}**! Cả hai cùng nhận daily mỗi ngày để nhận thêm quà TCG nhé.`,
        };
      }

      if (sub === "divorce") {
        const m = await deps.store.getMarriage(ctx.userId);
        if (!m) return { text: "Bạn chưa kết hôn nên không ly hôn được." };
        if ((ctx.args[1] ?? "").toLowerCase() !== "confirm") {
          return {
            text: `Ly hôn với <@${m.partnerId}>? Nhẫn cưới không được hoàn lại. Gõ \`marry divorce confirm\` để xác nhận.`,
          };
        }
        await deps.store.deleteMarriage(ctx.userId);
        return { text: `<@${ctx.userId}> và <@${m.partnerId}> đã ly hôn. Cả hai có thể cưới lại bất cứ lúc nào.` };
      }

      const target = ctx.mentions[0];
      if (target) {
        if (target === ctx.userId) return { text: "Không tự cưới chính mình được đâu." };
        const mine = await deps.store.getMarriage(ctx.userId);
        const theirs = await deps.store.getMarriage(target);
        if (mine && mine.partnerId !== target) return { text: "Bạn đã kết hôn rồi — ly hôn trước đã." };
        if (theirs && theirs.partnerId !== ctx.userId) return { text: "Người ấy đã kết hôn rồi." };
        const outgoing = await deps.store.pendingProposalFrom(ctx.userId);
        if (outgoing) return { text: "Bạn đang có một lời cầu hôn chờ trả lời — đợi hết hạn hoặc được trả lời đã." };
        const incoming = await deps.store.pendingProposalFor(target);
        if (incoming && incoming.expiresAt.getTime() > now().getTime()) {
          return { text: "Người ấy đang có lời cầu hôn khác đang chờ." };
        }
        // Best owned ring wins the proposal.
        let chosen: RingTier | null = null;
        for (const t of [...tiers].sort((a, b) => b.tier - a.tier)) {
          if ((await deps.store.ringQty(ctx.userId, t.tier)) > 0) { chosen = t; break; }
        }
        if (!chosen) return { text: "Bạn chưa có nhẫn nào — mua trước bằng `marry buy <bậc 1-7>` (xem `marry rings`)." };
        if (mine?.partnerId === target && chosen.tier <= mine.ringTier) {
          return { text: "Hai bạn đã cưới nhau rồi. Muốn nâng cấp nhẫn thì mua nhẫn cao hơn rồi cầu hôn lại." };
        }
        const p = await deps.store.createProposal(ctx.userId, target, chosen.tier, now());
        return {
          text:
            `<@${target}> — <@${ctx.userId}> cầu hôn bạn bằng **${chosen.name}**! ` +
            `Trả lời bằng \`marry accept\` hoặc \`marry reject\` trong 24 giờ. (Lời cầu hôn #${p.id})`,
        };
      }

      return { text: await statusText(ctx.userId), ephemeral: true };
    },
  };

  return [marry];
}

/**
 * Daily-claim hook (registry wires it into the economy `daily`
 * command): records the claim; when the spouse also claimed today,
 * both receive the couple gift in their TCG wallet.
 */
export function createCoupleDailyHook(deps: {
  store: MarriageStore;
  tcgStore: TcgStore;
  now?: () => Date;
}): (userId: string) => Promise<string | null> {
  return async (userId: string) => {
    try {
      const m = await deps.store.getMarriage(userId);
      if (!m) return null;
      const day = (deps.now ? deps.now() : new Date()).toISOString().slice(0, 10);
      const complete = await deps.store.recordCoupleDaily(userId, m.partnerId, day);
      if (!complete) return null;
      const gift = coupleGiftFor(userId, m.partnerId, day);
      for (const u of [userId, m.partnerId]) {
        await deps.tcgStore.adjustWallet(u, gift === "pack" ? { packsStandard: 1 } : { shards: 20 });
      }
      await deps.store.markCoupleGifted(userId, m.partnerId, day);
      return gift === "pack"
        ? "Quà vợ chồng: cả hai cùng nhận daily hôm nay — mỗi người được **+1 Gói Thường** TCG!"
        : "Quà vợ chồng: cả hai cùng nhận daily hôm nay — mỗi người được **+20 Mảnh thẻ** TCG!";
    } catch {
      return null;
    }
  };
}
