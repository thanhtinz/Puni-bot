/**
 * Reaction commands — spec 6.9. All 69 reactions share ONE handler; each
 * reaction is registered as its own prefix command (no slash quota used),
 * plus a single grouped slash command `/reaction <tên> [@người]`.
 * Per-guild overrides (disable, edited templates, cooldown) come from
 * guild settings and layer over the shared defaults.
 */
import {
  REACTIONS,
  getReaction,
  renderReactionText,
  type CommandDef,
} from "@puni/shared";
import type { GuildSettingsProvider } from "../guild-settings";
import { fetchReactionGif } from "../services/otakugifs";

export const DEFAULT_REACTION_COOLDOWN_SEC = 3;

export function createReactionCommands(deps: {
  settings: GuildSettingsProvider;
  botName: string;
}): CommandDef[] {
  const { settings, botName } = deps;

  const runReaction = async (
    reactionName: string,
    ctx: Parameters<CommandDef["handler"]>[0],
  ) => {
    const def = getReaction(reactionName);
    if (!def) return { text: `Không tìm thấy reaction "${reactionName}".` };
    const override = ctx.guildId
      ? (await settings.get(ctx.guildId)).reactionOverrides[def.name]
      : undefined;
    if (override?.enabled === false) {
      return { text: `Reaction "${def.name}" đang tắt ở server này.` };
    }
    const targetId = ctx.mentions[0];
    const effective = {
      ...def,
      tagText: override?.tagText ?? def.tagText,
      soloText: override?.soloText ?? def.soloText,
    };
    const text = renderReactionText(effective, {
      sender: `<@${ctx.userId}>`,
      target: targetId ? `<@${targetId}>` : undefined,
      botName,
    });
    const imageUrl = (await fetchReactionGif(def.name)) ?? undefined;
    return { text, imageUrl };
  };

  const defs: CommandDef[] = REACTIONS.map((r) => ({
    name: r.name,
    description: `Reaction: ${r.name}`,
    module: "reaction" as const,
    permission: "everyone" as const,
    slash: false, // prefix-only: saves the ~100 slash quota (spec 6.9.2)
    prefix: true,
    cooldownSec: DEFAULT_REACTION_COOLDOWN_SEC,
    handler: (ctx) => runReaction(r.name, ctx),
  }));

  defs.push({
    name: "reaction",
    description: "Gửi một reaction GIF (gõ tên reaction, có thể tag một người)",
    module: "reaction",
    permission: "everyone",
    slash: true,
    prefix: false,
    cooldownSec: DEFAULT_REACTION_COOLDOWN_SEC,
    handler: (ctx) => {
      const name = (ctx.args[0] ?? "").toLowerCase();
      if (!name) {
        return Promise.resolve({
          text: `Có ${REACTIONS.length} reaction: ${REACTIONS.map((r) => r.name).join(", ")}`,
        });
      }
      return runReaction(name, ctx);
    },
  });

  return defs;
}
