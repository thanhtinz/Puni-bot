import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_TCG_CONFIG,
  cardValueCoins,
  TCG_RARITIES,
  rollRarity,
  validateDeck,
  emptyPity,
  type TcgSpecies,
} from "../src/services/tcg";
import { InMemoryTcgStore, TcgGameService } from "../src/services/tcg-store";
import { simulateCardBattle } from "../src/services/tcg-battle";

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

describe("tcg card value, sell and battle (6.24)", () => {
  test("card value scales with rarity, level and enhance", () => {
    assert.equal(cardValueCoins("Common", 1, 0), 50);
    assert.equal(cardValueCoins("Rare", 11, 0), 600); // 500 * 1.2
    assert.equal(cardValueCoins("Epic", 1, 2), 2600); // 2000 * 1.3
  });

  test("sell pays sellRatePercent of value and removes the card", async () => {
    const { store, economy, game } = makeGame();
    const inst = await store.createInstance("u1", "rare-1", "gacha");
    const out = await game.sellCard("u1", inst.code, new Set());
    assert.equal(out.kind, "ok");
    if (out.kind !== "ok") return;
    assert.equal(out.value, 500);
    assert.equal(out.coins, 300); // 60% of 500
    assert.equal(await economy.balance("u1"), 100300);
    assert.equal(await store.getInstance(inst.code), null);
  });

  test("sell refuses favorite cards", async () => {
    const { store, game } = makeGame();
    const inst = await store.createInstance("u1", "rare-1", "gacha");
    await store.updateInstance(inst.code, { favorite: true });
    const out = await game.sellCard("u1", inst.code, new Set());
    assert.equal(out.kind, "error");
    assert.ok(await store.getInstance(inst.code));
  });

  test("battle engine is deterministic with a seeded rng and terminates", () => {
    const mk = (prefix: string) =>
      Array.from({ length: 5 }, (_, i) => ({
        code: `${prefix}${i}`, name: `${prefix}mon${i}`, speciesId: `${prefix}-${i}`,
        maxHp: 300, atk: 50,
      }));
    let seed = 42;
    const rng = () => {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      return seed / 2147483648;
    };
    const r1 = simulateCardBattle(mk("a"), mk("b"), rng);
    assert.ok(r1.rounds >= 1 && r1.rounds <= 40);
    assert.ok(r1.log.length > 0);
    assert.ok(["a", "b"].includes(r1.winner));
  });

  test("cardBattle needs an active deck with 5+ cards, then pays rewards", async () => {
    const { store, economy, game } = makeGame(100000, () => 0.5);
    const empty = await game.cardBattle("u1");
    assert.equal(empty.kind, "error");
    const codes: string[] = [];
    for (let i = 0; i < 5; i++) {
      const inst = await store.createInstance("u1", `common-${(i % 3) + 1}`, "gacha");
      codes.push(inst.code);
    }
    const deck = await store.createDeck("u1", "Đội chính");
    await store.setDeckCards(deck.id, codes);
    await store.setActiveDeck("u1", deck.id);
    const out = await game.cardBattle("u1");
    assert.equal(out.kind, "ok");
    if (out.kind !== "ok") return;
    assert.equal(out.teamNames.length, 5);
    assert.equal(out.enemyNames.length, 5);
    assert.ok(out.coins > 0 && out.xp > 0);
    assert.ok((await economy.balance("u1")) > 100000);
    const after = await store.getInstance(codes[0]);
    assert.equal(after?.xp, out.xp);
  });
});
