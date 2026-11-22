import assert from "node:assert/strict";
import test from "node:test";
import {
  InMemoryVoteStore,
  computeVoteReward,
  normalizeVoteConfig,
} from "../src/services/vote";

test("vote reward: base, weekend x2, qualified member x2, stacked x4", () => {
  const cfg = normalizeVoteConfig(null);
  assert.equal(computeVoteReward(cfg, { isWeekend: false, isQualifiedMember: false }), 100);
  assert.equal(computeVoteReward(cfg, { isWeekend: true, isQualifiedMember: false }), 200);
  assert.equal(computeVoteReward(cfg, { isWeekend: false, isQualifiedMember: true }), 200);
  assert.equal(computeVoteReward(cfg, { isWeekend: true, isQualifiedMember: true }), 400);
});

test("vote config: clamps and https-only vote url", () => {
  const cfg = normalizeVoteConfig({
    rewardPerVote: 9_999_999,
    weekendMultiplier: 99,
    voteUrl: "http://insecure.example/vote",
  });
  assert.equal(cfg.rewardPerVote, 1_000_000);
  assert.equal(cfg.weekendMultiplier, 10);
  assert.equal(cfg.voteUrl, "");
  assert.equal(
    normalizeVoteConfig({ voteUrl: "https://top.gg/bot/123/vote" }).voteUrl,
    "https://top.gg/bot/123/vote",
  );
});

test("vote store: 12h dedupe window, totals accumulate after the window", async () => {
  const store = new InMemoryVoteStore();
  const t0 = new Date("2026-11-21T00:00:00Z");
  const rec = { userId: "u1", reward: 100, isWeekend: false, at: t0 };
  assert.ok(await store.record(rec));
  // 3 hours later: duplicate (top.gg retry / double submit).
  assert.equal(
    await store.record({ ...rec, at: new Date(t0.getTime() + 3 * 3600 * 1000) }),
    null,
  );
  // 12h later: a fresh legitimate vote.
  assert.ok(await store.record({ ...rec, at: new Date(t0.getTime() + 12 * 3600 * 1000) }));
  assert.deepEqual(await store.totals("u1"), { votes: 2, earned: 200 });
  assert.equal((await store.lastVote("u1"))?.at.getTime(), t0.getTime() + 12 * 3600 * 1000);
});
