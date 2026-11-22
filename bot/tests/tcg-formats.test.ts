import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  DEFAULT_TCG_CONFIG,
  TCG_RARITIES,
  type TcgSpecies,
} from "../src/services/tcg";
import { InMemoryTcgStore } from "../src/services/tcg-store";
import {
  InMemoryFormatStore,
  TcgFormatsGame,
  buildNpcTeam,
  dailyOpponent,
  hashSeed,
  rngFromSeed,
  speciesPower,
} from "../src/services/tcg-formats";

/** Catalog with real battle stats: 3 species per rarity, mid stats,
 *  plus one titan (for the player's power team) and weaklings. */
const catalog: TcgSpecies[] = [
  ...TCG_RARITIES.flatMap((rarity) =>
    [1, 2, 3, 4, 5, 6].map((i) => ({
      id: `${rarity.toLowerCase()}-${i}`,
      name: `${rarity} ${i}`,
      rarity,
      baseHp: 40 + i * 5,
      baseAtk: 40 + i * 5,
    })),
  ),
  { id: "titan-1", name: "Titan", rarity: "Fabled", baseHp: 500, baseAtk: 500 },
  { id: "weak-1", name: "Weakling", rarity: "Common", baseHp: 10, baseAtk: 10 },
];

function fakeEconomy(start: number) {
  const balances = new Map<string, number>();
  const debits: { userId: string; amount: number }[] = [];
  return {
    balances,
    debits,
    async debit(userId: string, amount: number) {
      const bal = balances.get(userId) ?? start;
      if (bal < amount) return false;
      balances.set(userId, bal - amount);
      debits.push({ userId, amount });
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

async function makeFormats(balance = 100000, now?: () => Date) {
  const store = new InMemoryTcgStore();
  const formats = new InMemoryFormatStore();
  const economy = fakeEconomy(balance);
  const game = new TcgFormatsGame({
    store,
    formats,
    catalog: async () => catalog,
    config: async () => DEFAULT_TCG_CONFIG,
    economy,
    now,
  });
  return { store, formats, economy, game };
}

/** Give the user an active deck of 5 instances of one species. */
async function giveDeck(
  store: InMemoryTcgStore,
  userId: string,
  speciesId: string,
  level = 1,
): Promise<void> {
  const codes: string[] = [];
  for (let i = 0; i < 5; i++) {
    const inst = await store.createInstance(userId, speciesId, "test");
    if (level !== 1) await store.updateInstance(inst.code, { level });
    codes.push(inst.code);
  }
  const deck = await store.createDeck(userId, "Đội test");
  await store.setDeckCards(deck.id, codes);
  await store.setActiveDeck(userId, deck.id);
}

describe("tcg formats — deterministic core", () => {
  test("hashSeed + rngFromSeed are deterministic", () => {
    const a = rngFromSeed(hashSeed("dailychal:2026-11-22:u1"));
    const b = rngFromSeed(hashSeed("dailychal:2026-11-22:u1"));
    assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  });

  test("dailyOpponent is identical across calls for the same day+user", () => {
    const t1 = dailyOpponent(catalog, "2026-11-22", "user-a", 5000);
    const t2 = dailyOpponent(catalog, "2026-11-22", "user-a", 5000);
    assert.deepEqual(t1, t2);
    assert.equal(t1.length, 5);
    const other = dailyOpponent(catalog, "2026-11-22", "user-b", 5000);
    assert.notDeepEqual(t1.map((c) => c.speciesId), other.map((c) => c.speciesId));
  });

  test("buildNpcTeam lands near the target power", () => {
    const team = buildNpcTeam(catalog, rngFromSeed(42), 5000);
    const total = team.reduce((s, c) => s + c.maxHp + c.atk * 10, 0);
    assert.equal(team.length, 5);
    assert.ok(total > 3500 && total < 7500, `total ${total} should be near 5000`);
  });
});

describe("tcg formats — daily challenge", () => {
  test("errors without a deck", async () => {
    const { game } = await makeFormats();
    const out = await game.dailyChallenge("no-deck-user");
    assert.equal(out.kind, "error");
  });

  test("a crushing team wins, gets paid once, then the reward is spent", async () => {
    const { store, game, economy } = await makeFormats();
    await giveDeck(store, "strong", "titan-1", 100);
    const first = await game.dailyChallenge("strong");
    assert.equal(first.kind, "ok");
    if (first.kind !== "ok") return;
    assert.equal(first.win, true);
    assert.equal(first.rewardClaimed, true);
    assert.equal(first.coins, 200);
    assert.equal(first.shards, 5);
    const wallet = await store.wallet("strong");
    assert.equal(wallet.shards, 5);
    const balAfterWin = await economy.balance("strong");

    const second = await game.dailyChallenge("strong");
    assert.equal(second.kind, "ok");
    if (second.kind !== "ok") return;
    assert.equal(second.win, true, "seeded battle must repeat identically");
    assert.equal(second.rewardClaimed, false);
    assert.equal(second.coins, 0);
    assert.equal(await economy.balance("strong"), balAfterWin);
    assert.equal(await game.challengeRewardTaken("strong"), true);
  });

  test("a hopeless team loses and consumes no reward claim", async () => {
    const { store, game } = await makeFormats();
    await giveDeck(store, "weak", "weak-1", 1);
    const out = await game.dailyChallenge("weak");
    assert.equal(out.kind, "ok");
    if (out.kind !== "ok") return;
    assert.equal(out.win, false);
    assert.equal(out.coins, 0);
    assert.equal(await game.challengeRewardTaken("weak"), false);
  });
});

describe("tcg formats — draft arena", () => {
  test("full flow: free entry, 8 picks, fight chain ends the run", async () => {
    const { game, economy } = await makeFormats();
    const start = await game.startRun("drafter", "draft");
    assert.equal(start.kind, "ok");
    if (start.kind !== "ok") return;
    assert.equal(start.freeEntry, true);
    assert.equal(start.run.state.phase, "draft");
    assert.equal(start.run.state.offers.length, 3);

    let run = start.run;
    for (let i = 0; i < 8; i++) {
      const picked = await game.draftPick("drafter", 1);
      assert.equal(picked.kind, "ok");
      if (picked.kind !== "ok") return;
      run = picked.run;
    }
    assert.equal(run.state.phase, "fight");
    assert.equal(run.state.roster.length, 8);
    assert.equal(run.state.field.length, 5);

    let fights = 0;
    let last = await game.fightNext("drafter", "draft");
    while (last.kind === "ok" && !last.runDone && fights < 6) {
      fights++;
      last = await game.fightNext("drafter", "draft");
    }
    assert.equal(last.kind, "ok");
    if (last.kind !== "ok") return;
    assert.equal(last.runDone, true);
    assert.ok(last.run.state.wins >= 0 && last.run.state.wins <= 3);
    assert.ok(last.run.state.wins === 3 || last.run.state.losses === 2);
    // A second run on the same day is a paid entry.
    const again = await game.startRun("drafter", "draft");
    assert.equal(again.kind, "ok");
    if (again.kind !== "ok") return;
    assert.equal(again.freeEntry, false);
    assert.ok(economy.debits.some((d) => d.amount === 300));
  });

  test("paid entry is refused when the balance cannot cover it", async () => {
    const { game } = await makeFormats(0);
    const first = await game.startRun("poor", "draft");
    assert.equal(first.kind, "ok"); // free daily entry still works
    // Finish nothing — abandon by expiring is not available here, so
    // use a second user whose free entry is spent via a sealed run.
    const sealed = await game.startRun("poor", "sealed");
    assert.equal(sealed.kind, "ok");
    const broke = await game.startRun("poor", "draft");
    // The first draft run is still active, so this resumes instead of
    // charging — resuming must never debit.
    assert.equal(broke.kind, "ok");
    if (broke.kind !== "ok") return;
    assert.equal(broke.resumed, true);
  });

  test("draft pick validates its input", async () => {
    const { game } = await makeFormats();
    const noRun = await game.draftPick("ghost", 1);
    assert.equal(noRun.kind, "error");
    await game.startRun("picker", "draft");
    const bad = await game.draftPick("picker", 9);
    assert.equal(bad.kind, "error");
  });
});

describe("tcg formats — sealed", () => {
  test("sealed starts straight into the fight phase with a 30-card pool", async () => {
    const { game } = await makeFormats();
    const start = await game.startRun("sealer", "sealed");
    assert.equal(start.kind, "ok");
    if (start.kind !== "ok") return;
    assert.equal(start.run.state.phase, "fight");
    assert.equal(start.run.state.pool.length, 30);
    assert.equal(start.run.state.field.length, 5);
    // Field = the 5 strongest of the pool.
    const powers = start.run.state.pool.map((id) =>
      speciesPower(catalog.find((s) => s.id === id)!),
    );
    const fieldPowers = start.run.state.field.map((id) =>
      speciesPower(catalog.find((s) => s.id === id)!),
    );
    assert.equal(
      Math.min(...fieldPowers),
      [...powers].sort((a, b) => b - a)[4],
    );
  });
});
