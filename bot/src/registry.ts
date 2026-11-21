/** Assembles the single command registry (spec 6.3) from all modules. */
import { CommandRegistry } from "@puni/shared";
import { createCoreCommands } from "./commands/core";
import { createReactionCommands } from "./commands/reactions";
import { createEconomyCommands } from "./commands/economy";
import { createModerationCommands } from "./commands/moderation";
import {
  EconomyService,
  DEFAULT_ECONOMY_CONFIG,
  type EconomyStore,
} from "./services/economy";
import {
  InMemoryModCaseStore,
  type ModCaseStore,
} from "./services/mod-cases";
import type { GuildSettingsProvider } from "./guild-settings";

export interface BotDeps {
  registry: CommandRegistry;
  economy: EconomyService;
  cases: ModCaseStore;
}

export function buildBot(deps: {
  settings: GuildSettingsProvider;
  economyStore?: EconomyStore;
  caseStore?: ModCaseStore;
  botName?: string;
  version?: string;
}): BotDeps {
  const registry = new CommandRegistry();
  const economy = new EconomyService(deps.economyStore, DEFAULT_ECONOMY_CONFIG);
  const cases = deps.caseStore ?? new InMemoryModCaseStore();
  const startedAt = Date.now();

  const defs = [
    ...createCoreCommands({
      registry,
      settings: deps.settings,
      startedAt,
      version: deps.version ?? "0.1.0",
    }),
    ...createReactionCommands({ settings: deps.settings, botName: deps.botName ?? "Puni" }),
    ...createEconomyCommands({ economy, currencyName: DEFAULT_ECONOMY_CONFIG.currencyName }),
    ...createModerationCommands({ cases }),
  ];
  for (const def of defs) registry.register(def);
  return { registry, economy, cases };
}
