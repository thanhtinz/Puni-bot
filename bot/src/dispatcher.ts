/**
 * Unified dispatcher — spec 6.3. Slash and prefix invocations funnel into
 * the same invoke() path: same gates, same cooldowns, same handler.
 *
 * Gates, in order:
 * 1. Hidden-shop law (spec 6.15): a shop command in a guild without Shop
 *    enabled is treated as a command that does not exist.
 * 2. Module switch off -> also "does not exist".
 * 3. Permission level (everyone < mod < admin < owner; bot owner bypasses).
 * 4. Per-user cooldown.
 */
import type {
  CommandContext,
  CommandDef,
  CommandPermission,
  CommandRegistry,
  CommandResult,
} from "@puni/shared";
import type { GuildSettingsProvider } from "./guild-settings";

export type PermissionRank = 0 | 1 | 2 | 3;
const RANK: Record<CommandPermission, PermissionRank> = {
  everyone: 0,
  mod: 1,
  admin: 2,
  owner: 3,
};

export type PermissionResolver = (userId: string, guildId: string | null) => Promise<PermissionRank>;

export type DispatchOutcome =
  | { kind: "ok"; result: CommandResult }
  | { kind: "ignored" }
  | { kind: "forbidden" }
  | { kind: "cooldown"; secondsLeft: number }
  | { kind: "error"; error: unknown };

export interface ParsedPrefix {
  name: string;
  args: string[];
  mentions: string[];
}

const MENTION_RE = /<@!?(\d+)>/g;

export function extractMentions(content: string): string[] {
  return [...content.matchAll(MENTION_RE)].map((m) => m[1]);
}

/** Parse a prefix message. Returns null when the content is not a command
 *  invocation for the given prefix. */
export function parsePrefixMessage(content: string, prefix: string): ParsedPrefix | null {
  if (!prefix || !content.startsWith(prefix)) return null;
  const body = content.slice(prefix.length).trim();
  if (!body) return null;
  const parts = body.split(/\s+/);
  const name = parts[0].toLowerCase();
  if (!/^[a-z0-9][a-z0-9_-]*$/i.test(name)) return null;
  return { name, args: parts.slice(1), mentions: extractMentions(content) };
}

/** Cooldown backend. In-memory per process by default; the Redis store
 *  (services/redis-cooldown.ts) shares cooldowns across the whole cluster
 *  so a user cannot dodge a cooldown by landing on another shard. */
export interface CooldownStore {
  /** Try to claim the cooldown slot. */
  tryAcquire(key: string, ttlSec: number): Promise<{ ok: true } | { ok: false; secondsLeft: number }>;
}

export class InMemoryCooldownStore implements CooldownStore {
  private until = new Map<string, number>();
  constructor(private now: () => number = () => Date.now()) {}

  async tryAcquire(key: string, ttlSec: number) {
    const now = this.now();
    const existing = this.until.get(key) ?? 0;
    if (existing > now) {
      return { ok: false as const, secondsLeft: Math.ceil((existing - now) / 1000) };
    }
    this.until.set(key, now + ttlSec * 1000);
    return { ok: true as const };
  }
}

export class Dispatcher {
  private cooldownStore: CooldownStore;

  constructor(
    private registry: CommandRegistry,
    private settings: GuildSettingsProvider,
    private permissionOf: PermissionResolver,
    private ownerDiscordId: string,
    opts: { cooldownStore?: CooldownStore; now?: () => number } = {},
  ) {
    this.cooldownStore = opts.cooldownStore ?? new InMemoryCooldownStore(opts.now);
  }

  async dispatchPrefix(input: {
    content: string;
    userId: string;
    guildId: string | null;
    channelId: string;
    /** Precomputed dispatcher rank for the caller (from Discord member
     *  permissions); when present it replaces the resolver lookup. */
    rank?: PermissionRank;
  }): Promise<DispatchOutcome> {
    if (!input.guildId) return { kind: "ignored" }; // prefix commands are guild-scoped
    const guild = await this.settings.get(input.guildId);
    const parsed = parsePrefixMessage(input.content, guild.prefix);
    if (!parsed) return { kind: "ignored" };
    const def = this.registry.resolve(parsed.name);
    if (!def || !def.prefix) return { kind: "ignored" };
    return this.invoke(
      def,
      {
        userId: input.userId,
        guildId: input.guildId,
        channelId: input.channelId,
        args: parsed.args,
        mentions: parsed.mentions,
        surface: "prefix",
      },
      input.rank,
    );
  }

  async dispatchSlash(input: {
    name: string;
    userId: string;
    guildId: string | null;
    channelId: string;
    args: string[];
    mentions: string[];
    rank?: PermissionRank;
  }): Promise<DispatchOutcome> {
    const def = this.registry.resolve(input.name);
    if (!def || !def.slash) return { kind: "ignored" };
    return this.invoke(
      def,
      {
        userId: input.userId,
        guildId: input.guildId,
        channelId: input.channelId,
        args: input.args,
        mentions: input.mentions,
        surface: "slash",
      },
      input.rank,
    );
  }

  private async invoke(
    def: CommandDef,
    ctx: CommandContext,
    rankOverride?: PermissionRank,
  ): Promise<DispatchOutcome> {
    if (ctx.guildId) {
      const guild = await this.settings.get(ctx.guildId);
      // Gate 1+2: hidden-shop law and module switches.
      if (def.module === "shop" && !guild.shopEnabled) return { kind: "ignored" };
      if (guild.modules[def.module] === false) return { kind: "ignored" };
    } else if (def.module === "shop") {
      return { kind: "ignored" }; // shop commands never run in DMs
    }

    // Gate 3: permission. "owner" commands belong to the bot owner alone;
    // the bot owner bypasses every other permission gate.
    const isOwner = this.ownerDiscordId !== "" && ctx.userId === this.ownerDiscordId;
    if (def.permission === "owner") {
      if (!isOwner) return { kind: "forbidden" };
    } else if (!isOwner) {
      const rank = rankOverride ?? (await this.permissionOf(ctx.userId, ctx.guildId));
      if (rank < RANK[def.permission]) return { kind: "forbidden" };
    }

    // Gate 4: cooldown (shared across the cluster when Redis is wired).
    const cooldownSec = def.cooldownSec ?? 0;
    if (cooldownSec > 0) {
      const claim = await this.cooldownStore.tryAcquire(`${def.name}:${ctx.userId}`, cooldownSec);
      if (!claim.ok) return { kind: "cooldown", secondsLeft: claim.secondsLeft };
    }

    try {
      const result = await def.handler(ctx);
      return { kind: "ok", result };
    } catch (error) {
      return { kind: "error", error };
    }
  }
}
