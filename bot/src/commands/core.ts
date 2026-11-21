/**
 * Core commands — spec 6.10 (Information group): help, ping, info, uptime.
 * `help` is generated from the registry itself, so it can never drift from
 * the commands that actually exist.
 */
import type { CommandDef, CommandRegistry } from "@puni/shared";
import type { GuildSettingsProvider } from "../guild-settings";

export function createCoreCommands(deps: {
  registry: CommandRegistry;
  settings: GuildSettingsProvider;
  startedAt: number;
  version: string;
}): CommandDef[] {
  const { registry, settings, startedAt, version } = deps;

  const help: CommandDef = {
    name: "help",
    aliases: ["h", "commands"],
    description: "Xem danh sách lệnh",
    module: "core",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      const visible = registry
        .publicCommands()
        .filter((c) => c.name !== "help");
      const lines = visible.map(
        (c) => `• **${c.name}** — ${c.description}`,
      );
      return {
        text: lines.length
          ? `**Danh sách lệnh**\n${lines.join("\n")}`
          : "Chưa có lệnh nào khả dụng.",
      };
    },
  };

  const ping: CommandDef = {
    name: "ping",
    description: "Kiểm tra độ trễ của bot",
    module: "core",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async () => ({ text: "Pong! 🏓" }),
  };

  const info: CommandDef = {
    name: "info",
    aliases: ["botinfo"],
    description: "Thông tin về bot Puni",
    module: "core",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async () => ({
      text: `**Puni** — bot cộng đồng — bạn nhỏ của mọi server.\nPhiên bản: ${version}\nTrang chủ: https://discord.bntshop.com`,
    }),
  };

  const uptime: CommandDef = {
    name: "uptime",
    description: "Thời gian bot đã chạy liên tục",
    module: "core",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async () => {
      const sec = Math.floor((Date.now() - startedAt) / 1000);
      const d = Math.floor(sec / 86400);
      const h = Math.floor((sec % 86400) / 3600);
      const m = Math.floor((sec % 3600) / 60);
      const s = sec % 60;
      const parts = [
        d ? `${d} ngày` : "",
        h ? `${h} giờ` : "",
        m ? `${m} phút` : "",
        `${s} giây`,
      ].filter(Boolean);
      return { text: `Bot đã chạy liên tục: **${parts.join(" ")}**` };
    },
  };

  return [help, ping, info, uptime];
}
