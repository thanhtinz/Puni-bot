/**
 * Fishing command — spec 6.20. Thin presentation over FishingService:
 * the catch auto-sells for Coins in v1; the fish NAME is drawn from
 * the owner-managed fish catalogue (game_fish) matching the rolled
 * rarity; member-exclusive fish only surface for members.
 */
import type { CommandDef } from "@puni/shared";
import {
  FISH_RARITY_LABELS,
  FishingService,
  type FishRarity,
} from "../services/fishing";

const FALLBACK_NAMES: Record<FishRarity, string> = {
  common: "Cá rô đồng",
  uncommon: "Cá trắm cỏ",
  rare: "Cá chép vàng",
  epic: "Cá hải tượng",
  legendary: "Cá rồng huyền thoại",
};

export function createFishingCommands(deps: {
  fishing: FishingService;
  fishNamesSource?: (rarity: FishRarity, userId: string) => Promise<string[]>;
  currencyName: string;
}): CommandDef[] {
  const fish: CommandDef = {
    name: "fish",
    aliases: ["cauca"],
    description: "Câu cá thư giãn — cá câu được tự bán lấy tiền",
    module: "games",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const outcome = await deps.fishing.cast(ctx.userId);
      if (outcome.kind === "disabled") {
        return { text: "Hồ câu đang đóng cửa (chủ bot tạm tắt câu cá)." };
      }
      if (outcome.kind === "cooldown") {
        return {
          text: `Cần nghỉ tay chút đã — câu tiếp sau ${outcome.waitSec} giây nữa nhé!`,
        };
      }
      const names = deps.fishNamesSource
        ? await deps.fishNamesSource(outcome.rarity, ctx.userId).catch(() => [])
        : [];
      const name =
        names.length > 0
          ? names[Math.floor(Math.random() * names.length)]
          : FALLBACK_NAMES[outcome.rarity];
      const label = FISH_RARITY_LABELS[outcome.rarity];
      if (outcome.credited <= 0) {
        return {
          text:
            `Bạn câu được **${name}** (${label})! Nhưng hôm nay bạn đã đạt trần tiền câu cá ` +
            `nên cá này chỉ để ngắm thôi — mai quay lại nhé!`,
        };
      }
      const tail = outcome.capped
        ? " (đã chạm trần tiền câu cá hôm nay nên chỉ nhận được phần này)"
        : "";
      return {
        text:
          `Bạn câu được **${name}** (${label}) và bán được **${outcome.credited.toLocaleString("vi-VN")}** ` +
          `${deps.currencyName}!${tail}`,
      };
    },
  };
  return [fish];
}
