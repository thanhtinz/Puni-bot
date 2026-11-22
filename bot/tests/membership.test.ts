/**
 * Membership (spec 6.19): tier normalization, cumulative perks, grant
 * stacking/expiry, and the daily bonus flowing into EconomyService.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_MEMBERSHIP_TIERS,
  InMemoryMembershipStore,
  effectivePerks,
  normalizeMembershipTiers,
} from "../src/services/membership";
import { EconomyService } from "../src/services/economy";
import { InMemoryGuildSettings } from "../src/guild-settings";
import { InMemoryMembershipOrderStore } from "../src/services/membership";
import { buildBot } from "../src/registry";

test("normalize tiers: seed defaults when unset, junk rows dropped, values clamped", () => {
  assert.equal(normalizeMembershipTiers(null).length, 3);
  assert.equal(normalizeMembershipTiers("nope").length, 3);
  const custom = normalizeMembershipTiers([
    { id: "A B!", name: "  Gói X  ", priceLabel: "10k", dailyBonusPercent: 999, extraTeams: -2, perks: [" a ", "", 5, "b"] },
    { name: "" },
    { id: "ab", name: "Trùng id" },
  ]);
  assert.equal(custom.length, 2);
  assert.equal(custom[0].id, "ab");
  assert.equal(custom[0].name, "Gói X");
  assert.equal(custom[0].dailyBonusPercent, 300);
  assert.equal(custom[0].extraTeams, 0);
  assert.deepEqual(custom[0].perks, ["a", "b"]);
  assert.equal(custom[1].id, "ab-2");
});

test("effective perks: cumulative allowances, own-tier daily percent", () => {
  const tiers = DEFAULT_MEMBERSHIP_TIERS;
  const t1 = effectivePerks(tiers, "dong-hanh");
  assert.equal(t1?.dailyBonusPercent, 25);
  assert.equal(t1?.exclusivePets, true);
  const t3 = effectivePerks(tiers, "hao-tam");
  assert.equal(t3?.dailyBonusPercent, 100);
  assert.equal(t3?.extraTeams, 2);
  assert.equal(t3?.extraLootboxPerDay, 0);
  assert.equal(t3?.exclusivePets, true);
  // TCG benefits (spec 6.19b): own-tier percents, best fee below.
  assert.equal(t1?.gachaDiscountPercent, 5);
  assert.equal(t1?.marketFeePercent, 4);
  assert.equal(t3?.gachaDiscountPercent, 20);
  assert.equal(t3?.marketFeePercent, 0);
  assert.equal(t3?.battleBonusPercent, 25);
  assert.equal(t3?.xpBonusPercent, 25);
  assert.equal(t3?.extraFreePacksPerDay, 1);
  assert.equal(effectivePerks(tiers, "khong-co"), null);
});

test("store: grant stacks from current expiry, expiry deactivates, revoke works", async () => {
  const store = new InMemoryMembershipStore();
  const t0 = new Date("2026-01-01T00:00:00Z");
  const rec = await store.grant({ userId: "u1", tierId: "ung-ho", days: 30, source: "manual", note: "", at: t0 });
  assert.equal(rec.expiresAt.toISOString(), "2026-01-31T00:00:00.000Z");
  // Renew 10 days later for 30 more: stacks from Jan 31, not from Jan 11.
  const t1 = new Date("2026-01-11T00:00:00Z");
  const rec2 = await store.grant({ userId: "u1", tierId: "ung-ho", days: 30, source: "manual", note: "", at: t1 });
  assert.equal(rec2.expiresAt.toISOString(), "2026-03-02T00:00:00.000Z");
  assert.equal(rec2.startedAt.toISOString(), "2026-01-01T00:00:00.000Z");
  assert.ok(await store.getActive("u1", new Date("2026-02-15T00:00:00Z")));
  assert.equal(await store.getActive("u1", new Date("2026-03-03T00:00:00Z")), null);
  await store.revoke("u1");
  assert.equal(await store.getActive("u1", t0), null);
});

test("daily bonus: member gets +50% on the whole daily, non-member unchanged, expired member unchanged", async () => {
  const store = new InMemoryMembershipStore();
  const now = new Date();
  await store.grant({ userId: "member", tierId: "ung-ho", days: 30, source: "manual", note: "", at: now });
  await store.grant({ userId: "expired", tierId: "hao-tam", days: 30, source: "manual", note: "", at: new Date(now.getTime() - 40 * 86_400_000) });

  const tiersSource = async () => DEFAULT_MEMBERSHIP_TIERS;
  const mk = () =>
    new EconomyService(undefined, undefined, undefined, async (userId) => {
      const rec = await store.getActive(userId, new Date());
      if (!rec) return 0;
      return effectivePerks(await tiersSource(), rec.tierId)?.dailyBonusPercent ?? 0;
    });
  // default config: dailyBase 100
  const memberClaim = await mk().claimDaily("member", now);
  assert.equal(memberClaim?.amount, 150);
  const plainClaim = await mk().claimDaily("plain", now);
  assert.equal(plainClaim?.amount, 100);
  const expiredClaim = await mk().claimDaily("expired", now);
  assert.equal(expiredClaim?.amount, 100);
});

test("pass command: member sees tier + expiry, guest sees the catalogue", async () => {
  const settings = new InMemoryGuildSettings();
  const { registry, membership } = buildBot({ settings });
  await membership.grant({
    userId: "u-member",
    tierId: "ung-ho",
    days: 30,
    source: "manual",
    note: "",
    at: new Date(),
  });
  const pass = registry.resolve("pass");
  assert.ok(pass);
  const ctxBase = { guildId: "g1", channelId: "c1", args: [], mentions: [], surface: "prefix" as const };
  const memberOut = await pass.handler({ ...ctxBase, userId: "u-member" });
  assert.match(memberOut.text, /Người ủng hộ/);
  assert.match(memberOut.text, /daily \+50%/);
  const guestOut = await pass.handler({ ...ctxBase, userId: "u-guest" });
  assert.match(guestOut.text, /chưa có gói hội viên/);
  assert.match(guestOut.text, /Bạn đồng hành/);
});

test("orders command: empty history message, then lists orders with status labels", async () => {
  const settings = new InMemoryGuildSettings();
  const orders = new InMemoryMembershipOrderStore();
  const { registry } = buildBot({ settings, membershipOrders: orders });
  const cmd = registry.resolve("orders");
  assert.ok(cmd);
  const ctxBase = { guildId: "g1", channelId: "c1", args: [], mentions: [], surface: "prefix" as const };
  const empty = await cmd.handler({ ...ctxBase, userId: "u-none" });
  assert.match(empty.text, /chưa có đơn/);
  orders.add({
    code: "PUNI-TEST1",
    userId: "u-buyer",
    tierId: "ung-ho",
    tierName: "Người ủng hộ",
    amount: 50000,
    days: 30,
    status: "paid",
    createdAt: new Date(),
    paidAt: new Date(),
  });
  const out = await cmd.handler({ ...ctxBase, userId: "u-buyer" });
  assert.match(out.text, /PUNI-TEST1/);
  assert.match(out.text, /50\.000đ/);
  assert.match(out.text, /Đã thanh toán/);
});

