import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_TCG_CONFIG,
  TCG_RARITIES,
  rollRarity,
  validateDeck,
  emptyPity,
  type TcgSpecies,
} from "../src/services/tcg";
import { InMemoryTcgStore, TcgGameService } from "../src/services/tcg-store";

const catalog: TcgSpecies[] = TCG_RARITIES.flatMap((rarity) =>
  [1, 2, 3].map((i) => ({ id: `${rarity.toLowerCase()}-${i}`, name: `${rarity} ${i}`, rarity })),
);

function fakeEconomy(start: number) {
  const balances = new Map<string, number>();
  return {
    balances,
    async debit(userId: string, amount: number) {
      const bal = balances.get(userId) ?? start;
      if (bal < amount) return false;
      balances.set(userId, bal - amount);
      return true;
    },
    async credit(userId: string, amount: number) {
      balances.set(userId, (balances.get(userId) ?? start) + amount);
    },
    async balance(userId: string) {
      return balances.get(userId) ?? start;
    },
  };
}

function makeGame(balance = 100000, rng: () => number = Math.random) {
  const store = new InMemoryTcgStore();
  const economy = fakeEconomy(balance);
  const game = new TcgGameService({
    store,
    catalog: async () => catalog,
    config: async () => DEFAULT_TCG_CONFIG,
    economy,
    rng,
  });
  return { store, economy, game };
}

describe("tcg gacha", () => {
  test("pity forces Epic+ at 30 and Legendary+ at 90", () => {
    const cfg = DEFAULT_TCG_CONFIG;
    const epic = rollRarity(() => 0, cfg, { ...emptyPity(), sinceEpic: cfg.pityEpic - 1 });
    assert.ok(["Epic", "Legendary", "Mythical", "Fabled"].includes(epic));
    const leg = rollRarity(() => 0, cfg, { ...emptyPity(), sinceLegendary: cfg.pityLegendary - 1 });
    assert.ok(["Legendary", "Mythical", "Fabled"].includes(leg));
  });

  test("single pull debits, creates instance, advances pity + points", async () => {
    const { store, economy, game } = makeGame();
    const out = await game.pull("u1", "standard", 1);
    assert.equal(out.kind, "ok");
    if (out.kind !== "ok") return;
    assert.equal(out.results.length, 1);
    assert.equal(await economy.balance("u1"), 100000 - 500);
    const pity = await store.getPity("u1", "standard");
    assert.equal(pity.totalPulls, 1);
    assert.equal(pity.summonPoints, 1);
    assert.equal((await store.listInstances("u1")).length, 1);
  });

  test("multi pull yields 10 and guarantees Rare+", async () => {
    // rng = 0 always rolls the first tier (Common) without guarantees.
    const { game } = makeGame(100000, () => 0);
    const out = await game.pull("u1", "standard", 10);
    assert.equal(out.kind, "ok");
    if (out.kind !== "ok") return;
    assert.equal(out.results.length, 10);
    assert.ok(out.results.some((r) => r.rarity === "Rare"), "10th pull upgraded to Rare");
  });

  test("insufficient funds refuses without creating instances", async () => {
    const { store, game } = makeGame(100);
    const out = await game.pull("u1", "standard", 1);
    assert.equal(out.kind, "error");
    assert.equal((await store.listInstances("u1")).length, 0);
  });

  test("beginner banner locks after 30 total pulls", async () => {
    const { store, game } = makeGame();
    for (let i = 0; i < 3; i++) await game.pull("u1", "beginner", 10);
    assert.equal(await store.totalPullsAll("u1"), 30);
    const out = await game.pull("u1", "beginner", 1);
    assert.equal(out.kind, "error");
  });

  test("pack opening consumes the pack and grants 5 cards", async () => {
    const { store, game } = makeGame();
    await store.adjustWallet("u1", { packsStandard: 1 });
    const out = await game.openPack("u1", false);
    assert.equal(out.kind, "ok");
    if (out.kind !== "ok") return;
    assert.equal(out.results.length, 5);
    assert.equal((await store.wallet("u1")).packsStandard, 0);
  });
});

describe("tcg cards + decks", () => {
  test("burn refuses locked cards and pays shards for normal ones", async () => {
    const { store, game } = makeGame();
    const inst = await store.createInstance("u1", "rare-1", "gacha");
    await store.updateInstance(inst.code, { locked: true });
    const locked = await game.burn("u1", inst.code, new Set());
    assert.equal(locked.kind, "error");
    await store.updateInstance(inst.code, { locked: false });
    const done = await game.burn("u1", inst.code, new Set());
    assert.equal(done.kind, "ok");
    if (done.kind === "ok") assert.equal(done.shards, 8); // Rare = 8 shards
    assert.equal((await store.wallet("u1")).shards, 8);
    assert.equal(await store.getInstance(inst.code), null);
  });

  test("deck validation enforces size, copies and species spread", () => {
    const rules = { size: 30, maxCopies: 3, minSpecies: 10 };
    const ok = Array.from({ length: 30 }, (_, i) => `sp-${i % 10}-${Math.floor(i / 10)}`)
      .map((_, i) => `species-${i % 10}`);
    // 30 cards, 10 species x3 copies each = valid
    assert.deepEqual(validateDeck(ok, rules), []);
    const tooManyCopies = [...ok.slice(0, 29), "species-0"];
    assert.ok(validateDeck(tooManyCopies, rules).some((e) => e.includes("tối đa")));
    assert.ok(validateDeck(ok.slice(0, 20), rules).some((e) => e.includes("đúng 30")));
  });
});
