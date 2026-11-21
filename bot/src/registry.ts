/** Assembles the single command registry (spec 6.3) from all modules. */
import { CommandRegistry } from "@puni/shared";
import { createCoreCommands } from "./commands/core";
import { createReactionCommands } from "./commands/reactions";
import { createEconomyCommands } from "./commands/economy";
import { EconomyService, DEFAULT_ECONOMY_CONFIG } from "./services/economy";
import type { GuildSettingsProvider } from "./guild-settings";

export interface BotDeps {
  registry: CommandRegistry;
  economy: EconomyService;
}

export function buildBot(deps: {
  settings: GuildSettingsProvider;
  botName?: string;
  version?: string;
}): BotDeps {
  const registry = new CommandRegistry();
  const economy = new EconomyService(DEFAULT_ECONOMY_CONFIG);
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
  ];
  for (const def of defs) registry.register(def);
  return { registry, economy };
}
