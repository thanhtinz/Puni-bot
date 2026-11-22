/**
 * Vote command — spec 6.22. Shows the top.gg vote link and the
 * caller's vote status (last vote, when they can vote again, totals).
 * Crediting happens in the web webhook, never here.
 */
import type { CommandDef } from "@puni/shared";
import {
  VOTE_WINDOW_MS,
  normalizeVoteConfig,
  type VoteConfig,
  type VoteStore,
} from "../services/vote";

export function createVoteCommands(deps: {
  voteStore?: VoteStore;
  voteConfigSource?: () => Promise<VoteConfig>;
  voteBotIdSource?: () => string | null;
  currencyName: string;
}): CommandDef[] {
  const vote: CommandDef = {
    name: "vote",
    aliases: ["binhchon"],
    description: "Vote cho Puni trên top.gg và nhận tiền thưởng",
    module: "economy",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const cfg = deps.voteConfigSource
        ? await deps.voteConfigSource().catch(() => normalizeVoteConfig(null))
        : normalizeVoteConfig(null);
      if (!cfg.enabled) {
        return { text: "Hệ thống vote đang tạm tắt. Quay lại sau nhé!" };
      }
      const botId = deps.voteBotIdSource?.() ?? null;
      const url = cfg.voteUrl || (botId ? `https://top.gg/bot/${botId}/vote` : "");
      const lines: string[] = [];
      lines.push(
        url
          ? `Vote cho Puni tại ${url} — mỗi lượt vote nhận **${cfg.rewardPerVote.toLocaleString("vi-VN")}** ${deps.currencyName} (cuối tuần x${cfg.weekendMultiplier}, hội viên từ gói 2 x${cfg.memberMultiplier})!`
          : `Mỗi lượt vote nhận **${cfg.rewardPerVote.toLocaleString("vi-VN")}** ${deps.currencyName}. Link vote đang được cập nhật, quay lại sau nhé!`,
      );
      if (deps.voteStore) {
        const [last, totals] = await Promise.all([
          deps.voteStore.lastVote(ctx.userId).catch(() => null),
          deps.voteStore.totals(ctx.userId).catch(() => ({ votes: 0, earned: 0 })),
        ]);
        if (totals.votes > 0) {
          lines.push(
            `Bạn đã vote ${totals.votes} lần, nhận tổng **${totals.earned.toLocaleString("vi-VN")}** ${deps.currencyName}.`,
          );
        }
        if (last) {
          const next = last.at.getTime() + VOTE_WINDOW_MS;
          if (Date.now() < next) {
            lines.push(
              `Lượt vote tiếp theo mở lúc ${new Date(next).toLocaleString("vi-VN")}.`,
            );
          } else {
            lines.push("Bạn có thể vote tiếp ngay bây giờ!");
          }
        }
      }
      return { text: lines.join("\n") };
    },
  };
  return [vote];
}
