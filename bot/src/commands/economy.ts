/**
 * Economy commands — spec 6.16.1. Flat names for now (balance/daily/pay/
 * ecotop); the grouped `/eco` subcommand surface is layered on the same
 * handlers when the slash layout is finalized. The economy is GLOBAL:
 * these commands intentionally ignore guild boundaries for balances.
 */
import type { CommandDef } from "@puni/shared";
import { EconomyService, InsufficientFundsError } from "../services/economy";
import { formatMoneyPair, type GemsWallet } from "../services/gems";

export function createEconomyCommands(deps: {
  economy: EconomyService;
  currencyName: string;
  gemsName: string;
  gems: GemsWallet;
}): CommandDef[] {
  const { economy, currencyName, gemsName, gems } = deps;
  /** Money display law: Coins and Gems ALWAYS appear together. */
  const pair = async (userId: string) =>
    formatMoneyPair(
      await economy.getBalance(userId),
      await gems.getBalance(userId),
      currencyName,
      gemsName,
    );
  const fmt = (n: number) => `${n.toLocaleString("vi-VN")} ${currencyName}`;

  const balance: CommandDef = {
    name: "balance",
    aliases: ["bal", "money"],
    description: "Xem số dư economy (dùng chung mọi server)",
    module: "economy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const target = ctx.mentions[0] ?? ctx.userId;
      // Balance display law (owner, 2026-11-21 16:24 + 16:26): money in
      // chat is ONE simple text line, and it ALWAYS shows both
      // currencies together — Coins and Gems — never one alone.
      const money = await pair(target);
      return {
        text:
          target === ctx.userId
            ? `| <@${target}>, bạn hiện có ${money}!`
            : `| <@${target}> hiện có ${money}!`,
      };
    },
  };

  const daily: CommandDef = {
    name: "daily",
    description: "Nhận thưởng economy hằng ngày (1 lần/ngày trên toàn hệ thống)",
    module: "economy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const claim = await economy.claimDaily(ctx.userId);
      if (!claim) {
        return { text: "Bạn đã nhận daily hôm nay rồi — mai quay lại nhé!", ephemeral: true };
      }
      return {
        text: `Bạn nhận **${fmt(claim.amount)}** (chuỗi ${claim.streak} ngày). Số dư: ${await pair(ctx.userId)}`,
      };
    },
  };

  const pay: CommandDef = {
    name: "pay",
    aliases: ["transfer"],
    description: "Chuyển economy cho người khác: pay @người <số tiền>",
    module: "economy",
    permission: "everyone",
    slash: true,
    prefix: true,
    cooldownSec: 3,
    handler: async (ctx) => {
      const target = ctx.mentions[0];
      const amountRaw = ctx.args.find((a) => /^\d+$/.test(a));
      const amount = amountRaw ? Number.parseInt(amountRaw, 10) : NaN;
      if (!target) return { text: "Hãy tag người nhận: `pay @người <số tiền>`", ephemeral: true };
      if (target === ctx.userId) return { text: "Không thể tự chuyển cho chính mình.", ephemeral: true };
      if (!Number.isInteger(amount) || amount <= 0)
        return { text: "Số tiền phải là số nguyên dương.", ephemeral: true };
      try {
        await economy.transfer(ctx.userId, target, amount);
      } catch (e) {
        if (e instanceof InsufficientFundsError) {
          return { text: `Số dư không đủ để chuyển ${fmt(amount)}.`, ephemeral: true };
        }
        throw e;
      }
      return {
        text: `<@${ctx.userId}> đã chuyển **${fmt(amount)}** cho <@${target}>. Số dư của bạn: ${await pair(ctx.userId)}`,
      };
    },
  };

  const ecotop: CommandDef = {
    name: "ecotop",
    aliases: ["top"],
    description: "Bảng xếp hạng economy toàn hệ thống",
    module: "economy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async () => {
      const rows = await economy.top(10);
      if (!rows.length) return { text: "Chưa có ai có số dư economy." };
      const lines = rows.map((r, i) => `${i + 1}. <@${r.userId}> — **${fmt(r.balance)}**`);
      return { text: `**BXH Economy toàn hệ thống**\n${lines.join("\n")}` };
    },
  };

  return [balance, daily, pay, ecotop];
}
