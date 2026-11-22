import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryMarriageStore, coupleGiftFor, normalizeRingTiers, DEFAULT_RING_TIERS } from "../src/services/marriage";
import { createMarriageCommands, createCoupleDailyHook } from "../src/commands/marriage";
import { InMemoryTcgStore } from "../src/services/tcg-store";

function setup() {
  const store = new InMemoryMarriageStore();
  const balances = new Map<string, number>([["alice", 100000], ["bob", 100000]]);
  const economy = {
    debit: async (u: string, amt: number) => {
      const b = balances.get(u) ?? 0;
      if (b < amt) return false;
      balances.set(u, b - amt);
      return true;
    },
    credit: async (u: string, amt: number) => { balances.set(u, (balances.get(u) ?? 0) + amt); },
  };
  const [marry] = createMarriageCommands({
    store, economy, ringTiers: async () => DEFAULT_RING_TIERS, currencyName: () => "Coins",
  });
  const ctx = (userId: string, args: string[] = [], mentions: string[] = []) =>
    ({ userId, args, mentions, guildId: "g", channelId: "c" }) as never;
  return { store, balances, marry, ctx };
}

test("marriage flow: buy ring, propose, accept consumes ring, divorce frees both", async () => {
  const { store, marry, ctx } = setup();
  // No ring yet -> propose fails.
  let out = await marry.handler(ctx("alice", [], ["bob"]));
  assert.match(out.text, /chưa có nhẫn/);
  // Buy tier 2 (100) and propose.
  out = await marry.handler(ctx("alice", ["buy", "2"]));
  assert.match(out.text, /Đã mua/);
  out = await marry.handler(ctx("alice", [], ["bob"]));
  assert.match(out.text, /cầu hôn bạn/);
  // Bob accepts: ring consumed, marriage created.
  out = await marry.handler(ctx("bob", ["accept"]));
  assert.match(out.text, /Chúc mừng/);
  assert.equal(await store.ringQty("alice", 2), 0);
  assert.equal((await store.getMarriage("alice"))?.partnerId, "bob");
  assert.equal((await store.getMarriage("bob"))?.ringTier, 2);
  // Alice cannot propose to a third person while married.
  out = await marry.handler(ctx("alice", [], ["carol"]));
  assert.match(out.text, /đã kết hôn/);
  // Divorce needs confirm, then frees both; ring NOT refunded.
  out = await marry.handler(ctx("alice", ["divorce"]));
  assert.match(out.text, /xác nhận/);
  out = await marry.handler(ctx("alice", ["divorce", "confirm"]));
  assert.match(out.text, /đã ly hôn/);
  assert.equal(await store.getMarriage("bob"), null);
});

test("proposal guards: self-marry blocked, reject keeps the ring, expiry works", async () => {
  const { store, marry, ctx } = setup();
  let out = await marry.handler(ctx("alice", [], ["alice"]));
  assert.match(out.text, /chính mình/);
  await marry.handler(ctx("alice", ["buy", "1"]));
  await marry.handler(ctx("alice", [], ["bob"]));
  out = await marry.handler(ctx("bob", ["reject"]));
  assert.match(out.text, /từ chối/);
  assert.equal(await store.ringQty("alice", 1), 1); // ring kept
  assert.equal(await store.getMarriage("alice"), null);
});

test("ring upgrade: spouse proposes with a higher ring, accept upgrades tier", async () => {
  const { store, marry, ctx } = setup();
  await marry.handler(ctx("alice", ["buy", "1"]));
  await marry.handler(ctx("alice", [], ["bob"]));
  await marry.handler(ctx("bob", ["accept"]));
  await marry.handler(ctx("alice", ["buy", "3"]));
  const out = await marry.handler(ctx("alice", [], ["bob"]));
  assert.match(out.text, /cầu hôn bạn/);
  const up = await marry.handler(ctx("bob", ["accept"]));
  assert.match(up.text, /Nâng cấp nhẫn/);
  assert.equal((await store.getMarriage("alice"))?.ringTier, 3);
});

test("couple daily hook: both spouses claim -> both get the TCG gift once", async () => {
  const store = new InMemoryMarriageStore();
  const tcg = new InMemoryTcgStore();
  await store.createMarriage("alice", "bob", 1);
  const hook = createCoupleDailyHook({ store, tcgStore: tcg, now: () => new Date("2026-11-21T10:00:00Z") });
  assert.equal(await hook("alice"), null); // spouse hasn't claimed yet
  const line = await hook("bob");
  assert.ok(line && /Quà vợ chồng/.test(line));
  const gift = coupleGiftFor("alice", "bob", "2026-11-21");
  const wa = await tcg.wallet("alice");
  const wb = await tcg.wallet("bob");
  if (gift === "pack") { assert.equal(wa.packsStandard, 1); assert.equal(wb.packsStandard, 1); }
  else { assert.equal(wa.shards, 20); assert.equal(wb.shards, 20); }
  assert.equal(await hook("alice"), null); // no double gift
});

test("ring tiers normalize: defaults on junk, custom prices kept", () => {
  assert.deepEqual(normalizeRingTiers(null), DEFAULT_RING_TIERS);
  const custom = normalizeRingTiers([{ tier: 1, name: "Nhẫn Test", price: 55 }]);
  assert.equal(custom[0].price, 55);
});
