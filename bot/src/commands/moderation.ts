/**
 * Moderation commands backed by the CASE system — spec 6.7/6.10.
 * Milestone scope: warn + case lookup/edit + modlogs listing. The
 * Discord-side enforcement actions (timeout/kick/ban API calls) attach
 * to these same case records in the enforcement milestone; a case is
 * always written first so no action ever goes unrecorded.
 */
import type { CommandDef } from "@puni/shared";
import type { ModCase, ModCaseStore } from "../services/mod-cases";

function formatCase(c: ModCase): string {
  const when = c.createdAt.toISOString().slice(0, 10);
  const dur = c.durationSec ? ` • ${Math.round(c.durationSec / 60)} phút` : "";
  const state = c.active ? "" : " • đã đóng";
  return `**Case #${c.caseNo}** — ${c.action} • <@${c.targetId}> • bởi <@${c.moderatorId}> • ${when}${dur}${state}\nLý do: ${c.reason || "(không ghi)"}`;
}

export function createModerationCommands(deps: { cases: ModCaseStore }): CommandDef[] {
  const { cases } = deps;

  const warn: CommandDef = {
    name: "warn",
    description: "Cảnh cáo một thành viên (tạo case): warn @người <lý do>",
    module: "moderation",
    permission: "mod",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      if (!ctx.guildId) return { text: "Lệnh này chỉ dùng trong server.", ephemeral: true };
      const target = ctx.mentions[0];
      if (!target) return { text: "Hãy tag người cần warn: `warn @người <lý do>`", ephemeral: true };
      const reason = ctx.args.filter((a) => !/^<@!?\d+>$/.test(a)).join(" ").trim();
      const created = await cases.create({
        guildId: ctx.guildId,
        targetId: target,
        moderatorId: ctx.userId,
        action: "warn",
        reason,
      });
      const total = await cases.countForTarget(ctx.guildId, target, "warn");
      return {
        text: `Đã cảnh cáo <@${target}> — **Case #${created.caseNo}** (tổng ${total} warn trong server này).${reason ? `\nLý do: ${reason}` : ""}`,
      };
    },
  };

  const viewCase: CommandDef = {
    name: "case",
    description: "Xem một case, hoặc sửa lý do: case <số> [reason <lý do mới>]",
    module: "moderation",
    permission: "mod",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      if (!ctx.guildId) return { text: "Lệnh này chỉ dùng trong server.", ephemeral: true };
      const caseNo = Number.parseInt(ctx.args[0] ?? "", 10);
      if (!Number.isInteger(caseNo) || caseNo <= 0)
        return { text: "Hãy nhập số case: `case <số>`", ephemeral: true };
      if (ctx.args[1] === "reason") {
        const reason = ctx.args.slice(2).join(" ").trim();
        const updated = await cases.update(ctx.guildId, caseNo, { reason });
        if (!updated) return { text: `Không tìm thấy case #${caseNo}.`, ephemeral: true };
        return { text: `Đã sửa lý do case #${caseNo}.\n${formatCase(updated)}` };
      }
      const found = await cases.get(ctx.guildId, caseNo);
      if (!found) return { text: `Không tìm thấy case #${caseNo}.`, ephemeral: true };
      return { text: formatCase(found) };
    },
  };

  const casesCmd: CommandDef = {
    name: "cases",
    aliases: ["modlogs"],
    description: "Xem lịch sử moderation của một thành viên: cases @người",
    module: "moderation",
    permission: "mod",
    slash: true,
    prefix: true,
    handler: async (ctx) => {
      if (!ctx.guildId) return { text: "Lệnh này chỉ dùng trong server.", ephemeral: true };
      const target = ctx.mentions[0] ?? (/^\d+$/.test(ctx.args[0] ?? "") ? ctx.args[0] : undefined);
      if (!target) return { text: "Hãy tag người cần xem: `cases @người`", ephemeral: true };
      const list = await cases.listForTarget(ctx.guildId, target, 10);
      if (!list.length) return { text: `<@${target}> chưa có case nào trong server này.` };
      return {
        text: `**Lịch sử moderation của <@${target}>** (${list.length} case gần nhất)\n${list.map(formatCase).join("\n")}`,
      };
    },
  };

  return [warn, viewCase, casesCmd];
}
