/**
 * Moderation commands backed by the CASE system — spec 6.7/6.10.
 * Milestone scope: warn + case lookup/edit + modlogs listing. The
 * Discord-side enforcement actions (timeout/kick/ban API calls) attach
 * to these same case records in the enforcement milestone; a case is
 * always written first so no action ever goes unrecorded.
 */
import type { CommandDef } from "@puni/shared";
import type { CaseAction, ModCase, ModCaseStore } from "../services/mod-cases";
import {
  MAX_TIMEOUT_SEC,
  formatDuration,
  parseDuration,
  type Enforcer,
} from "../services/enforcement";

function stripMentions(args: string[]): string[] {
  return args.filter((a) => !/^<@!?\d+>$/.test(a));
}

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

/**
 * Enforcement commands — mute/unmute/kick/ban/unban. Every action writes
 * its case FIRST (intent), then enforces; if enforcement fails, the case
 * is deactivated and the reply says so — the audit trail keeps both the
 * successful actions and the failed attempts, never a silent gap.
 */
export function createEnforcementCommands(deps: {
  cases: ModCaseStore;
  enforcer: Enforcer;
}): CommandDef[] {
  const { cases, enforcer } = deps;

  function actionCommand(input: {
    name: string;
    description: string;
    action: CaseAction;
    needsDuration?: boolean;
    /** Target is a raw user id argument instead of a mention (unban). */
    targetFromArgs?: boolean;
    run: (ctx: { guildId: string; target: string; reason: string; durationSec: number | null }) => Promise<void>;
  }): CommandDef {
    return {
      name: input.name,
      description: input.description,
      module: "moderation",
      permission: "mod",
      slash: true,
      prefix: true,
      handler: async (ctx) => {
        if (!ctx.guildId) return { text: "Lệnh này chỉ dùng trong server.", ephemeral: true };
        const rest = stripMentions(ctx.args);
        let target = ctx.mentions[0];
        if (!target && input.targetFromArgs && /^\d+$/.test(rest[0] ?? "")) {
          target = rest[0];
          rest.shift();
        }
        if (!target)
          return { text: `Hãy tag người cần ${input.name}: \`${input.name} @người\``, ephemeral: true };
        let durationSec: number | null = null;
        if (input.needsDuration) {
          const parsed = rest.length ? parseDuration(rest[0]) : null;
          if (parsed === null)
            return {
              text: "Hãy nhập thời lượng dạng 30s / 10m / 2h / 1d (tối đa 28 ngày).",
              ephemeral: true,
            };
          if (parsed > MAX_TIMEOUT_SEC)
            return { text: "Thời lượng vượt quá giới hạn 28 ngày của Discord.", ephemeral: true };
          durationSec = parsed;
          rest.shift();
        }
        const reason = rest.join(" ").trim();
        const created = await cases.create({
          guildId: ctx.guildId,
          targetId: target,
          moderatorId: ctx.userId,
          action: input.action,
          reason,
          durationSec,
        });
        try {
          await input.run({ guildId: ctx.guildId, target, reason, durationSec });
        } catch (err) {
          await cases.setActive(ctx.guildId, created.caseNo, false);
          console.error(`[puni] enforcement ${input.action} failed`, err);
          return {
            text: `Không thực hiện được ${input.action} với <@${target}> (lỗi từ Discord). Case #${created.caseNo} đã đóng.`,
            ephemeral: true,
          };
        }
        if (input.action === "unmute" || input.action === "unban") {
          // Lifting an action closes the target's matching open cases.
          const open = await cases.listForTarget(ctx.guildId, target, 25);
          const match = input.action === "unmute" ? "mute" : "ban";
          for (const c of open) {
            if (c.action === match && c.active) {
              await cases.setActive(ctx.guildId, c.caseNo, false);
            }
          }
        }
        const durText = durationSec ? ` trong ${formatDuration(durationSec)}` : "";
        return {
          text: `Đã ${input.action} <@${target}>${durText} — **Case #${created.caseNo}**${reason ? `\nLý do: ${reason}` : ""}`,
        };
      },
    };
  }

  return [
    actionCommand({
      name: "mute",
      description: "Mute (timeout) một thành viên: mute @người <thời lượng> <lý do>",
      action: "mute",
      needsDuration: true,
      run: ({ guildId, target, reason, durationSec }) =>
        enforcer.timeout(guildId, target, durationSec ?? 0, reason),
    }),
    actionCommand({
      name: "unmute",
      description: "Gỡ mute của một thành viên: unmute @người",
      action: "unmute",
      run: ({ guildId, target, reason }) => enforcer.removeTimeout(guildId, target, reason),
    }),
    actionCommand({
      name: "kick",
      description: "Kick một thành viên: kick @người <lý do>",
      action: "kick",
      run: ({ guildId, target, reason }) => enforcer.kick(guildId, target, reason),
    }),
    actionCommand({
      name: "ban",
      description: "Ban một thành viên: ban @người <lý do>",
      action: "ban",
      run: ({ guildId, target, reason }) => enforcer.ban(guildId, target, reason),
    }),
    actionCommand({
      name: "unban",
      description: "Gỡ ban cho một user ID: unban <userId>",
      action: "unban",
      targetFromArgs: true,
      run: ({ guildId, target, reason }) => enforcer.unban(guildId, target, reason),
    }),
  ];
}
