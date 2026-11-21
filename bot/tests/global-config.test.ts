import { test } from "node:test";
import assert from "node:assert/strict";
import {
  EconomyService,
  InMemoryEconomyStore,
  normalizeEconomyConfig,
  DEFAULT_ECONOMY_CONFIG,
} from "../src/services/economy";
import { shouldTriggerAiChat } from "../src/services/ai-chat";

test("normalize economy config: defaults for junk, clamps for extremes", () => {
  assert.deepEqual(normalizeEconomyConfig(null), DEFAULT_ECONOMY_CONFIG);
  assert.deepEqual(normalizeEconomyConfig("x"), DEFAULT_ECONOMY_CONFIG);
  const c = normalizeEconomyConfig({
    currencyName: "  Xu  ",
    dailyBase: 250.9,
    dailyStreakBonus: -5,
    dailyStreakBonusCap: 10 ** 12,
  });
  assert.equal(c.currencyName, "Xu");
  assert.equal(c.dailyBase, 250);
  assert.equal(c.dailyStreakBonus, 0);
  assert.equal(c.dailyStreakBonusCap, 1_000_000);
  const blank = normalizeEconomyConfig({ currencyName: "   " });
  assert.equal(blank.currencyName, DEFAULT_ECONOMY_CONFIG.currencyName);
});

test("economy service: live config source drives daily amounts", async () => {
  let cfg = { ...DEFAULT_ECONOMY_CONFIG, dailyBase: 100, dailyStreakBonus: 10 };
  const eco = new EconomyService(new InMemoryEconomyStore(), cfg, async () => cfg);
  const d1 = await eco.claimDaily("u1", new Date("2026-03-01T10:00:00Z"));
  assert.deepEqual(d1, { amount: 100, streak: 1 });
  // Owner edits the config in the Admin panel — next claim uses it live.
  cfg = { ...cfg, dailyBase: 500, dailyStreakBonus: 50 };
  const d2 = await eco.claimDaily("u1", new Date("2026-03-02T10:00:00Z"));
  assert.deepEqual(d2, { amount: 550, streak: 2 });
});

test("economy service: a broken config source falls back to the snapshot", async () => {
  const eco = new EconomyService(
    new InMemoryEconomyStore(),
    { ...DEFAULT_ECONOMY_CONFIG, dailyBase: 42 },
    async () => {
      throw new Error("db down");
    },
  );
  const d = await eco.claimDaily("u9", new Date("2026-03-01T10:00:00Z"));
  assert.deepEqual(d, { amount: 42, streak: 1 });
});

test("ai chat predicate: owner master switch blocks even a perfect trigger", () => {
  const base = {
    mentionsBot: true,
    isCommand: false,
    guildEnabled: true,
    providerConfigured: true,
  };
  assert.equal(shouldTriggerAiChat(base), true);
  assert.equal(shouldTriggerAiChat({ ...base, globalEnabled: true }), true);
  assert.equal(shouldTriggerAiChat({ ...base, globalEnabled: false }), false);
});
