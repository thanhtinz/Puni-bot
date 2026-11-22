/** Assembles the single command registry (spec 6.3) from all modules. */
import { CommandRegistry } from "@puni/shared";
import { createCoreCommands } from "./commands/core";
import { createReactionCommands } from "./commands/reactions";
import { createEconomyCommands } from "./commands/economy";
import { createMembershipCommands } from "./commands/membership";
import { createVoteCommands } from "./commands/vote";
import { createTcgCommands, createTcgGroupCommands } from "./commands/tcg";
import { TcgGameService, InMemoryTcgStore, type TcgStore } from "./services/tcg-store";
import { DEFAULT_TCG_CONFIG, type TcgConfig, type TcgSpecies } from "./services/tcg";
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
  /** TCG store (spec 6.23); in-memory when absent. */
  tcgStore?: TcgStore;
  /** TCG species catalog (game_species); empty = TCG unavailable. */
  tcgCatalogSource?: () => Promise<TcgSpecies[]>;
  /** Live TCG config (Admin-editable later); defaults when absent. */
  tcgConfigSource?: () => Promise<TcgConfig>;
  /** Public dashboard base URL for card images in chat. */
  cardBaseUrl?: string;
  voteStore?: import("./services/vote").VoteStore;
  voteConfigSource?: () => Promise<import("./services/vote").VoteConfig>;
  voteBotIdSource?: () => string | null;
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

  const tcgStore = deps.tcgStore ?? new InMemoryTcgStore();
  const tcgCatalog = deps.tcgCatalogSource ?? (async () => [] as TcgSpecies[]);
  const tcgConfig = deps.tcgConfigSource ?? (async () => DEFAULT_TCG_CONFIG);
  const tcgEconomy = {
    debit: async (userId: string, amount: number, source: string, note?: string) => {
      try {
        await economy.debit(userId, amount, source, note ?? "");
        return true;
      } catch {
        return false;
      }
    },
    credit: async (userId: string, amount: number, source: string, note?: string) => {
      await economy.credit(userId, amount, source, note ?? "");
    },
    balance: (userId: string) => economy.getBalance(userId),
  };
  const tcgDeps = {
    game: new TcgGameService({
      store: tcgStore,
      catalog: tcgCatalog,
      config: tcgConfig,
      economy: tcgEconomy,
    }),
    store: tcgStore,
    catalog: tcgCatalog,
    config: tcgConfig,
    economy: tcgEconomy,
    currencyName: () => economyConfig.currencyName,
    cardBaseUrl: deps.cardBaseUrl ?? "",
  };

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
    ...createTcgCommands(tcgDeps),
    ...createTcgGroupCommands(tcgDeps),
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
