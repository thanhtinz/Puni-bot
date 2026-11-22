/** Assembles the single command registry (spec 6.3) from all modules. */
import { CommandRegistry } from "@puni/shared";
import { createCoreCommands } from "./commands/core";
import { createReactionCommands } from "./commands/reactions";
import { createEconomyCommands } from "./commands/economy";
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
}): BotDeps {
  const registry = new CommandRegistry();
  const economyConfig = deps.economyConfig ?? DEFAULT_ECONOMY_CONFIG;
  const economy = new EconomyService(deps.economyStore, economyConfig, deps.economyConfigSource);
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
    ...createModerationCommands({ cases }),
    ...createEnforcementCommands({ cases, enforcer }),
  ];
  for (const def of defs) registry.register(def);
  return {
    registry,
    economy,
    gems,
    cases,
    enforcer,
    addCaseHook: (hook) => {
      hooks.push(hook);
    },
  };
}
