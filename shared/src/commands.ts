/**
 * Unified command registry — spec 6.3.
 * One registry drives BOTH surfaces: a command is declared once and can be
 * exposed as a slash command, a prefix command, or both. Handlers are shared;
 * there is never a second implementation for the prefix variant.
 */

export type CommandPermission = "everyone" | "mod" | "admin" | "owner";

/** Module a command belongs to. "shop" commands are gated by the per-guild
 *  Shop module switch and the hidden-shop law (spec 6.15). */
export type CommandModule =
  | "core"
  | "shop"
  | "moderation"
  | "manager"
  | "role"
  | "embed"
  | "reaction"
  | "economy"
  | "games"
  | "cozy"
  | "community";

export interface CommandContext {
  /** Discord user id of the caller. */
  userId: string;
  /** Guild the command was invoked in, or null in DMs. */
  guildId: string | null;
  /** Channel the command was invoked in. */
  channelId: string;
  /** Raw argument string (prefix) — slash handlers map options into this shape too. */
  args: string[];
  /** Mentioned user ids, in order of appearance. */
  mentions: string[];
  /** Which surface invoked the command. */
  surface: "slash" | "prefix";
}

export interface CommandResult {
  /** Text/embed description to show. Kept transport-agnostic on purpose. */
  text: string;
  /** True when the reply must be ephemeral / self-deleting (personal data). */
  ephemeral?: boolean;
  /** Optional image URL (e.g. a reaction gif). */
  imageUrl?: string;
}

export type CommandHandler = (ctx: CommandContext) => Promise<CommandResult>;

export interface CommandDef {
  /** Canonical name (lowercase, no prefix). */
  name: string;
  /** Alternative names that resolve to the same handler. */
  aliases?: string[];
  description: string;
  module: CommandModule;
  permission: CommandPermission;
  /** Expose as a Discord slash command (counts against the ~100 ceiling, spec 6.10.4). */
  slash: boolean;
  /** Expose as a prefix command (does not consume slash quota). */
  prefix: boolean;
  /** Cooldown per user in seconds (0 = none). */
  cooldownSec?: number;
  handler: CommandHandler;
}

export class CommandRegistry {
  private byName = new Map<string, CommandDef>();

  register(def: CommandDef): void {
    const keys = [def.name, ...(def.aliases ?? [])];
    for (const key of keys) {
      const k = key.toLowerCase();
      if (this.byName.has(k)) {
        throw new Error(`Duplicate command name/alias in registry: ${k}`);
      }
      this.byName.set(k, def);
    }
  }

  resolve(name: string): CommandDef | undefined {
    return this.byName.get(name.toLowerCase());
  }

  /** All canonical commands (aliases excluded), in registration order. */
  all(): CommandDef[] {
    const seen = new Set<CommandDef>();
    const out: CommandDef[] = [];
    for (const def of this.byName.values()) {
      if (!seen.has(def)) {
        seen.add(def);
        out.push(def);
      }
    }
    return out;
  }

  slashCommands(): CommandDef[] {
    return this.all().filter((c) => c.slash);
  }

  prefixCommands(): CommandDef[] {
    return this.all().filter((c) => c.prefix);
  }

  /** Commands visible on the public /commands page (spec 6.13):
   *  community-facing only — no admin/mod/owner commands, and NO shop
   *  commands by default (hidden-shop law, spec 6.15). Pass
   *  `includeShop: true` only in the context of a guild with Shop enabled. */
  publicCommands(opts: { includeShop?: boolean } = {}): CommandDef[] {
    return this.all().filter(
      (c) =>
        c.permission === "everyone" &&
        (opts.includeShop === true || c.module !== "shop"),
    );
  }
}
