import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { InMemoryTcgStore } from "../src/services/tcg-store";
import {
  InMemoryQuestStore,
  QUEST_BONUS_COINS,
  QUEST_POOL,
  TcgQuestsGame,
  dailyQuests,
} from "../src/services/tcg-quests";

function fakeEconomy() {
  const balances = new Map<string, number>();
  return {
    balances,
    async debit(userId: string, amount: number) {
      const bal = balances.get(userId) ?? 0;
      if (bal < amount) return false;
      balances.set(userId, bal - amount);
      return true;
    },
    async credit(userId: string, amount: number) {
      balances.set(userId, (balances.get(userId) ?? 0) + amount);
    },
    async balance(userId: string) {
      return balances.get(userId) ?? 0;
    },
  };
}

function makeQuests(now?: () => Date) {
  const store = new InMemoryTcgStore();
  const quests = new InMemoryQuestStore();
  const economy = fakeEconomy();
  const game = new TcgQuestsGame({ store, quests, economy, now });
  return { store, quests, economy, game };
}

describe("tcg daily quests", () => {
  test("the daily set is deterministic and has 5 quests from the pool", () => {
    const a = dailyQuests("2026-11-22");
    const b = dailyQuests("2026-11-22");
    assert.deepEqual(a.map((q) => q.id), b.map((q) => q.id));
    assert.equal(a.length, 5);
    assert.equal(new Set(a.map((q) => q.id)).size, 5);
    for (const q of a) assert.ok(QUEST_POOL.some((p) => p.id === q.id));
    const other = dailyQuests("2026-11-23");
    assert.notDeepEqual(a.map((q) => q.id), other.map((q) => q.id));
  });

  test("bump only advances quests in today's set and caps at target", async () => {
    const { game } = makeQuests(() => new Date("2026-11-22T10:00:00Z"));
    const today = dailyQuests("2026-11-22");
    const pullQuest = today.find((q) => q.action === "pull");
    await game.bump("u1", "pull", 999);
    const view = await game.view("u1");
    if (pullQuest) {
      const row = view.rows.find((r) => r.id === pullQuest.id)!;
      assert.equal(row.progress, pullQuest.target);
      assert.equal(row.done, true);
    } else {
      assert.ok(view.rows.every((r) => r.progress === 0));
    }
  });

  test("claim pays once, refuses unfinished and double claims", async () => {
    const { game, economy, store } = makeQuests(() => new Date("2026-11-22T10:00:00Z"));
    const today = dailyQuests("2026-11-22");
    const q = today[0]!;
    const early = await game.claim("u2", q.id);
    assert.equal(early.kind, "error");
    await game.bump("u2", q.action, q.target);
    const paid = await game.claim("u2", q.id);
    assert.equal(paid.kind, "ok");
    if (paid.kind !== "ok") return;
    assert.equal(paid.coins, q.coins);
    assert.equal(paid.shards, q.shards);
    assert.equal(await economy.balance("u2"), q.coins);
    assert.equal((await store.wallet("u2")).shards, q.shards);
    const again = await game.claim("u2", q.id);
    assert.equal(again.kind, "error");
    assert.equal(await economy.balance("u2"), q.coins);
  });

  test("claiming all five pays the completion bonus exactly once", async () => {
    const { game, economy } = makeQuests(() => new Date("2026-11-22T10:00:00Z"));
    const today = dailyQuests("2026-11-22");
    let bonusSeen = 0;
    for (const q of today) {
      await game.bump("u3", q.action, q.target);
      const out = await game.claim("u3", q.id);
      assert.equal(out.kind, "ok");
      if (out.kind === "ok" && out.bonusCoins > 0) {
        bonusSeen++;
        assert.equal(out.bonusCoins, QUEST_BONUS_COINS);
      }
    }
    assert.equal(bonusSeen, 1);
    const questCoins = today.reduce((s, q) => s + q.coins, 0);
    assert.equal(await economy.balance("u3"), questCoins + QUEST_BONUS_COINS);
    const view = await game.view("u3");
    assert.equal(view.bonusClaimed, true);
    assert.ok(view.rows.every((r) => r.claimed));
  });
});
