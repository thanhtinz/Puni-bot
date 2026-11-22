/**
 * Assembles the single command registry from all modules.
 * Puni is a pure game bot (spec 6.28): TCG + economy + marriage +
 * membership. No server-management modules exist anymore.
 */
import { CommandRegistry } from "@puni/shared";
import { createCoreCommands } from "./commands/core";
import { createEconomyCommands } from "./commands/economy";
import { createMembershipCommands } from "./commands/membership";
import { createMarriageCommands, createCoupleDailyHook } from "./commands/marriage";
import { createTcgCommands, createTcgGroupCommands } from "./commands/tcg";
import { TcgGameService, InMemoryTcgStore, type TcgStore } from "./services/tcg-store";
import { DEFAULT_TCG_CONFIG, type TcgConfig, type TcgSpecies } from "./services/tcg";
import {
  DEFAULT_MEMBERSHIP_TIERS,
  InMemoryMembershipStore,
  effectivePerks,
  type MembershipStore,
} from "./services/membership";
import {
  DEFAULT_RING_TIERS,
  InMemoryMarriageStore,
  type MarriageStore,
  type RingTier,
} from "./services/marriage";
import {
  EconomyService,
  DEFAULT_ECONOMY_CONFIG,
  type EconomyConfig,
  type EconomyStore,
} from "./services/economy";
import { InMemoryGemsWallet, type GemsWallet } from "./services/gems";
import type { GuildSettingsProvider } from "./guild-settings";

export interface BotDeps {
  registry: CommandRegistry;
  economy: EconomyService;
  membership: MembershipStore;
  gems: GemsWallet;
  marriage: MarriageStore;
  tcgStore: TcgStore;
}

export function buildBot(deps: {
  settings: GuildSettingsProvider;
  economyStore?: EconomyStore;
  gemsWallet?: GemsWallet;
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
  /** Marriage store (spec 6.16.5); in-memory when absent. */
  marriageStore?: MarriageStore;
  /** Live ring tier definitions (owner-editable prices). */
  ringTiersSource?: () => Promise<RingTier[]>;
  /** TCG store (spec 6.23); in-memory when absent. */
  tcgStore?: TcgStore;
  /** TCG species catalog (game_species); empty = TCG unavailable. */
  tcgCatalogSource?: () => Promise<TcgSpecies[]>;
  /** Live TCG config (Admin-editable later); defaults when absent. */
  tcgConfigSource?: () => Promise<TcgConfig>;
  /** Public dashboard base URL for card images in chat. */
  cardBaseUrl?: string;
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
  const memberPerks = async (userId: string) => {
    const rec = await membership.getActive(userId, new Date()).catch(() => null);
    if (!rec) return null;
    const tiers = await tiersSource().catch(() => []);
    return effectivePerks(tiers, rec.tierId);
  };
  const tcgDeps = {
    game: new TcgGameService({
      store: tcgStore,
      catalog: tcgCatalog,
      config: tcgConfig,
      economy: tcgEconomy,
      memberPerks,
    }),
    store: tcgStore,
    catalog: tcgCatalog,
    config: tcgConfig,
    economy: tcgEconomy,
    currencyName: () => economyConfig.currencyName,
    cardBaseUrl: deps.cardBaseUrl ?? "",
    memberPerks,
  };

  const marriage = deps.marriageStore ?? new InMemoryMarriageStore();
  const ringTiers = deps.ringTiersSource ?? (async () => DEFAULT_RING_TIERS);
  const coupleDailyHook = createCoupleDailyHook({ store: marriage, tcgStore });

  const defs = [
    ...createCoreCommands({
      registry,
      settings: deps.settings,
      startedAt,
      version: deps.version ?? "0.1.0",
    }),
    ...createEconomyCommands({
      economy,
      currencyName: economyConfig.currencyName,
      gemsName: economyConfig.gemsName,
      gems,
      onDailyClaim: coupleDailyHook,
    }),
    ...createMembershipCommands({ membership, tiersSource, orders: deps.membershipOrders }),
    ...createMarriageCommands({
      store: marriage,
      economy: tcgEconomy,
      ringTiers,
      currencyName: () => economyConfig.currencyName,
    }),
    ...createTcgCommands(tcgDeps),
    ...createTcgGroupCommands(tcgDeps),
  ];
  for (const def of defs) registry.register(def);
  return { registry, economy, membership, gems, marriage, tcgStore };
}
