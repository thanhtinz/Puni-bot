/**
 * Channel game setup commands (spec 6.16) — server admins bind the
 * CURRENT channel to a counting or word-chain game:
 *   demso           → status      demso set → bật      demso off → tắt
 *   noichu          → status      noichu set → bật     noichu off → tắt
 * Playing needs no commands: members just type in the channel and
 * the bot validates every message (client hook).
 */
import type { CommandDef } from "@puni/shared";
import {
  freshCounting,
  freshWordchain,
  type ChannelGameKind,
  type ChannelGameStore,
  type CountingState,
  type WordchainState,
} from "../services/channel-games";

function setupCommand(
  name: string,
  aliases: string[],
  kind: ChannelGameKind,
  label: string,
  store: ChannelGameStore,
): CommandDef {
  return {
    name,
    aliases,
    description: `${label} cho kênh hiện tại (quản trị viên): set bật · off tắt`,
    module: "games",
    permission: "admin",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      if (!ctx.guildId) return { text: "Lệnh này chỉ dùng trong server." };
      const sub = (ctx.args[0] ?? "").toLowerCase();
      const existing = await store.get(ctx.guildId, ctx.channelId);
      if (sub === "set" || sub === "bat") {
        if (existing && existing.kind !== kind) {
          return { text: `Kênh này đang là kênh ${existing.kind === "counting" ? "đếm số" : "nối chữ"} — tắt trước bằng lệnh tương ứng rồi mới đổi được.` };
        }
        const fresh = kind === "counting" ? freshCounting() : freshWordchain();
        await store.set(ctx.guildId, ctx.channelId, kind, fresh as unknown as Record<string, unknown>);
        return {
          text: kind === "counting"
            ? "Đã bật **đếm số** ở kênh này! Mọi người cùng đếm từ **1** — sai số hoặc đếm hai lần liên tiếp là đếm lại từ đầu."
            : "Đã bật **nối chữ** ở kênh này! Gõ một cụm từ 2 tiếng trở lên; từ sau phải bắt đầu bằng tiếng cuối của từ trước.",
        };
      }
      if (sub === "off" || sub === "tat") {
        if (!existing || existing.kind !== kind) return { text: `Kênh này chưa bật ${label}.` };
        await store.delete(ctx.guildId, ctx.channelId);
        return { text: `Đã tắt ${label} ở kênh này.` };
      }
      if (!existing || existing.kind !== kind) {
        return { text: `Kênh này chưa bật ${label}. Quản trị viên bật bằng \`${name} set\`.` };
      }
      if (kind === "counting") {
        const s = existing.state as unknown as CountingState;
        return { text: `Đếm số: đang ở số **${s.current}**, kỷ lục **${s.best}**. Số tiếp theo: **${s.current + 1}**.` };
      }
      const s = existing.state as unknown as WordchainState;
      return {
        text: `Nối chữ: đã nối **${s.count}** từ${s.lastWord ? `, từ gần nhất: **${s.lastWord}**` : ""}.`,
      };
    },
  };
}

export function createChannelGameCommands(deps: { store: ChannelGameStore }): CommandDef[] {
  return [
    setupCommand("demso", ["counting", "noiso"], "counting", "đếm số", deps.store),
    setupCommand("noichu", ["noitu", "wordchain"], "wordchain", "nối chữ", deps.store),
  ];
}
