import { test } from "node:test";
import assert from "node:assert/strict";
import {
  eloDelta, rankTierFor, nextTierFor, softResetMmr, seasonKey,
  freshRankedProfile, rolloverProfile,
} from "../src/services/tcg-ranked";
import { InMemoryTcgStore, TcgGameService } from "../src/services/tcg-store";
import { DEFAULT_TCG_CONFIG, type TcgSpecies } from "../src/services/tcg";
import { effectivePerks, DEFAULT_MEMBERSHIP_TIERS } from "../src/services/membership";

test("ranked math: tiers, elo zero-sum, soft reset, season rollover", () => {
  assert.equal(rankTierFor(1000).id, "dong");
  assert.equal(rankTierFor(1250).id, "vang");
  assert.equal(rankTierFor(2100).id, "cao-thu");
  assert.equal(nextTierFor(1000)?.id, "bac");
  assert.equal(nextTierFor(2100), null);
  // Equal MMR: winner gains exactly K/2.
  assert.equal(eloDelta(1000, 1000), 16);
  // Underdog win pays more than favorite win.
  assert.ok(eloDelta(900, 1100) > eloDelta(1100, 900));
  assert.equal(softResetMmr(1600), 1300);
  assert.equal(softResetMmr(800), 900);
  assert.equal(seasonKey(new Date("2026-11-05T00:00:00Z")), "2026-11");
  const p = freshRankedProfile("u", new Date("2026-11-01T00:00:00Z"));
  p.mmr = 1600; p.seasonWins = 9;
  const rolled = rolloverProfile(p, new Date("2026-12-01T00:00:00Z"));
  assert.equal(rolled.mmr, 1300);
  assert.equal(rolled.seasonWins, 0);
  assert.equal(rolled.wins, 0); // totals preserved field exists; season counters reset
});

const CATALOG: TcgSpecies[] = Array.from({ length: 12 }, (_, i) => ({
  id: `sp${i}`, name: `Loài ${i}`, rarity: "Common" as const, baseHp: 50, baseAtk: 50,
}));

function makeGame(memberPerks?: (u: string) => Promise<unknown>) {
  const store = new InMemoryTcgStore();
  const balances = new Map<string, number>();
  const game = new TcgGameService({
    store,
    catalog: async () => CATALOG,
    config: async () => DEFAULT_TCG_CONFIG,
    economy: {
      debit: async (u, amt) => {
        const b = balances.get(u) ?? 0;
        if (b < amt) return false;
        balances.set(u, b - amt);
        return true;
      },
      credit: async (u, amt) => { balances.set(u, (balances.get(u) ?? 0) + amt); },
      balance: async (u) => balances.get(u) ?? 0,
    },
    memberPerks: memberPerks as never,
    rng: () => 0.42,
  });
  return { store, game, balances };
}

async function giveDeck(store: InMemoryTcgStore, userId: string) {
  const codes: string[] = [];
  for (let i = 0; i < 5; i++) {
    const inst = await store.createInstance(userId, `sp${i}`, "test");
    codes.push(inst.code);
  }
  const deck = await store.createDeck(userId, "Bộ chính");
  await store.setDeckCards(deck.id, codes);
  await store.setActiveDeck(userId, deck.id);
}

test("ranked battle: two deck owners fight, MMR moves, coins paid", async () => {
  const { store, game, balances } = makeGame();
  await giveDeck(store, "alice");
  await giveDeck(store, "bob");
  const out = await game.rankedBattle("alice");
  assert.equal(out.kind, "ok");
  if (out.kind !== "ok") return;
  assert.equal(out.opponentId, "bob");
  assert.ok(out.coins >= 30);
  assert.ok((balances.get("alice") ?? 0) > 0);
  const pa = await game.rankedProfile("alice");
  const pb = await game.rankedProfile("bob");
  assert.equal(pa.wins + pa.losses, 1);
  assert.equal(pb.wins + pb.losses, 1);
  assert.equal(pa.mmr + pb.mmr, 2000); // zero-sum
});

test("member gacha discount: a tier configured with 20% discount pays 20% less per pull", async () => {
  // The 2026-11-22 default tiers carry no gacha discount, but the
  // mechanism stays (admin-configurable) — cover it with a custom tier.
  const customTiers = [{ ...DEFAULT_MEMBERSHIP_TIERS[2], id: "pro", gachaDiscountPercent: 20 }];
  const perks = async (u: string) =>
    u === "vip" ? effectivePerks(customTiers, "pro") : null;
  const { game, balances } = makeGame(perks);
  balances.set("vip", 100000);
  balances.set("free", 100000);
  const banners = await (async () => {
    const { store } = makeGame();
    return store.listBanners();
  })();
  const std = banners.find((b) => b.id === "standard") ?? banners[0];
  const a = await game.pull("vip", std.id, 1);
  const b = await game.pull("free", std.id, 1);
  assert.equal(a.kind, "ok");
  assert.equal(b.kind, "ok");
  if (a.kind === "ok" && b.kind === "ok") {
    assert.equal(a.cost, Math.floor(b.cost * 0.8));
  }
});

test("duel battle: deterministic winner between two decks", async () => {
  const { store, game } = makeGame();
  await giveDeck(store, "alice");
  await giveDeck(store, "bob");
  const out = await game.duelBattle("alice", "bob");
  assert.equal(out.kind, "ok");
  if (out.kind !== "ok") return;
  assert.ok(out.winnerId === "alice" || out.winnerId === "bob");
  const d = await store.createDuel("alice", "bob", 500);
  assert.equal(d.status, "pending");
  const pending = await store.pendingDuelFor("bob");
  assert.equal(pending?.id, d.id);
  await store.resolveDuel(d.id, "done", out.winnerId);
  assert.equal((await store.getDuel(d.id))?.status, "done");
});
