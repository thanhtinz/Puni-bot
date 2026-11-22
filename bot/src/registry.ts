/** Assembles the single command registry (spec 6.3) from all modules. */
import { CommandRegistry } from "@puni/shared";
import { createCoreCommands } from "./commands/core";
import { createReactionCommands } from "./commands/reactions";
import { createEconomyCommands } from "./commands/economy";
import { createMembershipCommands } from "./commands/membership";
import { createFishingCommands } from "./commands/fishing";
import { createVoteCommands } from "./commands/vote";
import {
  DEFAULT_FISHING_CONFIG,
  FishingService,
  normalizeFishingConfig,
  type FishingConfig,
} from "./services/fishing";
import {
  DEFAULT_MEMBERSHIP_TIERS,
  InMemoryMembershipStore,
  effectivePerks,
  type MembershipStore,
} from "./services/membership";
import { createEnforcementCommands, createModerationCommands } from "./commands/moderation";
import {
  EconomyService,
  DEFAULT_ECONOMY_CONFIG,
  type EconomyConfig,
  type EconomyStore,
} from "./services/economy";
import {
  HookedModCaseStore,
  InMemoryModCaseStore,
  type CaseHook,
  type ModCaseStore,
} from "./services/mod-cases";
import { LateBindingEnforcer } from "./services/enforcement";
import { InMemoryGemsWallet, type GemsWallet } from "./services/gems";
import type { GuildSettingsProvider } from "./guild-settings";

export interface BotDeps {
  registry: CommandRegistry;
  economy: EconomyService;
  membership: MembershipStore;
  gems: GemsWallet;
  cases: ModCaseStore;
  enforcer: LateBindingEnforcer;
  /** Register a callback fired after every case creation (moderation log). */
  addCaseHook: (hook: CaseHook) => void;
}

export function buildBot(deps: {
  settings: GuildSettingsProvider;
  economyStore?: EconomyStore;
  gemsWallet?: GemsWallet;
  caseStore?: ModCaseStore;
  botName?: string;
  version?: string;
  /** Startup snapshot of the owner-edited economy config (Admin panel). */
  economyConfig?: EconomyConfig;
  /** Live economy config source; Admin edits apply without a restart. */
  economyConfigSource?: () => Promise<EconomyConfig>;
  /** Membership store (spec 6.19); in-memory when absent. */
  membershipStore?: MembershipStore;
  /** Live membership tier definitions (Admin panel), for the daily
   *  bonus and the `pass` command. */
  membershipTiersSource?: () => Promise<import("./services/membership").MembershipTier[]>;
  /** Membership order history store (spec 6.19) for `orders`. */
  membershipOrders?: import("./services/membership").MembershipOrderStore;
  /** Live fishing config (Admin panel → Câu cá). */
  fishingConfigSource?: () => Promise<FishingConfig>;
  /** Names for caught fish, from the owner-managed item catalogue. */
  fishNamesSource?: (rarity: string, isMember: boolean) => Promise<string[]>;
  voteStore?: import("./services/vote").VoteStore;
  voteConfigSource?: () => Promise<import("./services/vote").VoteConfig>;
  voteBotIdSource?: () => string | null;
  /** Coins a user already earned from fishing today (daily cap). */
  fishingEarnedToday?: (userId: string) => Promise<number>;
}): BotDeps {
  const registry = new CommandRegistry();
  const economyConfig = deps.economyConfig ?? DEFAULT_ECONOMY_CONFIG;
  const membership = deps.membershipStore ?? new InMemoryMembershipStore();
  const tiersSource =
    deps.membershipTiersSource ?? (async () => DEFAULT_MEMBERSHIP_TIERS);
  const dailyBonusSource = async (userId: string) => {
    const rec = await membership.getActive(userId, new Date()).catch(() => null);
    if (!rec) return 0;
    const tiers = await tiersSource().catch(() => []);
    return effectivePerks(tiers, rec.tierId)?.dailyBonusPercent ?? 0;
  };
  const economy = new EconomyService(
    deps.economyStore,
    economyConfig,
    deps.economyConfigSource,
    dailyBonusSource,
  );
  const gems = deps.gemsWallet ?? new InMemoryGemsWallet();
  const hooks: CaseHook[] = [];
  const cases = new HookedModCaseStore(deps.caseStore ?? new InMemoryModCaseStore(), hooks);
  const enforcer = new LateBindingEnforcer();
  const startedAt = Date.now();

  const defs = [
    ...createCoreCommands({
      registry,
      settings: deps.settings,
      startedAt,
      version: deps.version ?? "0.1.0",
    }),
    ...createReactionCommands({ settings: deps.settings, botName: deps.botName ?? "Puni" }),
    ...createEconomyCommands({ economy, currencyName: economyConfig.currencyName, gemsName: economyConfig.gemsName, gems }),
    ...createMembershipCommands({ membership, tiersSource, orders: deps.membershipOrders }),
    ...createVoteCommands({
      voteStore: deps.voteStore,
      voteConfigSource: deps.voteConfigSource,
      voteBotIdSource: deps.voteBotIdSource,
      currencyName: economyConfig.currencyName,
    }),
    ...createFishingCommands({
      fishing: new FishingService({
        configSource:
          deps.fishingConfigSource ?? (async () => normalizeFishingConfig(DEFAULT_FISHING_CONFIG)),
        earnedToday:
          deps.fishingEarnedToday ??
          (async (userId: string) => {
            const rows = await economy.ledgerFor(userId);
            const start = new Date();
            start.setHours(0, 0, 0, 0);
            return rows
              .filter((r) => r.source === "fishing" && r.createdAt >= start)
              .reduce((s, r) => s + Math.max(0, r.delta), 0);
          }),
        credit: async (userId, amount, note) => {
          await economy.credit(userId, amount, "fishing", note);
        },
        memberBoost: async (userId) => {
          const rec = await membership.getActive(userId, new Date()).catch(() => null);
          return rec
            ? { cooldownFactor: 0.5, capFactor: 2 }
            : { cooldownFactor: 1, capFactor: 1 };
        },
      }),
      fishNamesSource: deps.fishNamesSource
        ? async (rarity, userId) => {
            const rec = await membership.getActive(userId, new Date()).catch(() => null);
            return deps.fishNamesSource!(rarity, Boolean(rec));
          }
        : undefined,
      currencyName: economyConfig.currencyName,
    }),
    ...createModerationCommands({ cases }),
    ...createEnforcementCommands({ cases, enforcer }),
  ];
  for (const def of defs) registry.register(def);
  return {
    registry,
    economy,
    membership,
    gems,
    cases,
    enforcer,
    addCaseHook: (hook) => {
      hooks.push(hook);
    },
  };
}
