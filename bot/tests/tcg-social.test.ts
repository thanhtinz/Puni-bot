import assert from "node:assert/strict";
import { describe, test } from "node:test";
import { DEFAULT_TCG_CONFIG, deckEdition, validateDeck, type TcgSpecies } from "../src/services/tcg";
import { InMemoryTcgStore } from "../src/services/tcg-store";
import {
  InMemorySocialStore,
  TcgSocialGame,
} from "../src/services/tcg-social";

const catalog: TcgSpecies[] = [
  ...Array.from({ length: 12 }, (_, i) => ({
    id: `sp-${i + 1}`,
    name: `Species ${i + 1}`,
    rarity: "Rare" as const,
    baseHp: 60 + i * 5,
    baseAtk: 60 + i * 5,
  })),
  { id: "prize-1", name: "Prize Card", rarity: "Legendary", baseHp: 90, baseAtk: 90 },
  ...Array.from({ length: 10 }, (_, i) => ({
    id: `pkmjp-s${i + 1}`,
    name: `JP Species ${i + 1}`,
    rarity: "Rare" as const,
    baseHp: 70 + i * 5,
    baseAtk: 70 + i * 5,
  })),
];

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

async function makeSocial(balance = 100000) {
  const tcg = new InMemoryTcgStore();
  const social = new InMemorySocialStore();
  const economy = fakeEconomy(balance);
  const game = new TcgSocialGame({
    social,
    tcg,
    economy,
    speciesMap: async () => new Map(catalog.map((s) => [s.id, s] as const)),
    feePercentFor: async () => 5,
    deckRules: async () => ({
      size: DEFAULT_TCG_CONFIG.deckSize,
      maxCopies: DEFAULT_TCG_CONFIG.deckMaxCopies,
      minSpecies: DEFAULT_TCG_CONFIG.deckMinSpecies,
    }),
    pricePerUsd: async () => 1,
  });
  return { tcg, social, economy, game };
}

/** A valid 30-card deck: 10 species x 3 copies, set active. */
async function giveValidDeck(tcg: InMemoryTcgStore, userId: string, jp = false): Promise<string[]> {
  const codes: string[] = [];
  for (let s = 1; s <= 10; s++) {
    for (let c = 0; c < 3; c++) {
      const inst = await tcg.createInstance(userId, jp ? `pkmjp-s${s}` : `sp-${s}`, "test");
      codes.push(inst.code);
    }
  }
  const deck = await tcg.createDeck(userId, "Deck");
  await tcg.setDeckCards(deck.id, codes);
  await tcg.setActiveDeck(userId, deck.id);
  return codes;
}

describe("auctions", () => {
  test("create guards: locked card and in-deck card are rejected", async () => {
    const { tcg, game } = await makeSocial();
    const locked = await tcg.createInstance("seller", "prize-1", "test");
    await tcg.updateInstance(locked.code, { locked: true });
    const out1 = await game.createAuction("seller", locked.code, 100, 24, null);
    assert.equal(out1.ok, false);

    const inDeck = await tcg.createInstance("seller", "sp-1", "test");
    const deck = await tcg.createDeck("seller", "D");
    await tcg.setDeckCards(deck.id, [inDeck.code]);
    const out2 = await game.createAuction("seller", inDeck.code, 100, 24, null);
    assert.equal(out2.ok, false);

    const free = await tcg.createInstance("seller", "sp-2", "test");
    const out3 = await game.createAuction("seller", free.code, 100, 24, 1000);
    assert.equal(out3.ok, true);
    const dup = await game.createAuction("seller", free.code, 100, 24, null);
    assert.equal(dup.ok, false);
  });

  test("bid escrow, outbid refund, self-raise diff, buy-now settle", async () => {
    const { tcg, economy, game } = await makeSocial(10000);
    const card = await tcg.createInstance("seller", "prize-1", "test");
    const created = await game.createAuction("seller", card.code, 100, 24, 1000);
    assert.equal(created.ok, true);
    const id = created.id!;

    const low = await game.placeBid("a", id, 50);
    assert.equal(low.ok, false); // below the start price
    assert.ok((await game.placeBid("a", id, 100)).ok);
    assert.equal(await economy.balance("a"), 9900);
    assert.ok((await game.placeBid("b", id, 200)).ok);
    assert.equal(await economy.balance("b"), 9800);
    assert.equal(await economy.balance("a"), 10000); // refunded in full
    // a retakes the lead at 300: pays the full 300 (not top anymore)
    assert.ok((await game.placeBid("a", id, 300)).ok);
    assert.equal(await economy.balance("a"), 9700);
    assert.equal(await economy.balance("b"), 10000);
    // a raises own bid to 400: only the 100 difference is charged
    assert.ok((await game.placeBid("a", id, 400)).ok);
    assert.equal(await economy.balance("a"), 9600);
    // b buys now at 1000: a is refunded, seller gets 1000 - 5% fee
    assert.ok((await game.buyNow("b", id)).ok);
    assert.equal(await economy.balance("b"), 9000);
    assert.equal(await economy.balance("a"), 10000);
    assert.equal(await economy.balance("seller"), 10950);
    const moved = await tcg.getInstance(card.code);
    assert.equal(moved?.userId, "b");
  });

  test("cancel rules and expired settle on read", async () => {
    const { tcg, social, economy, game } = await makeSocial(10000);
    const card = await tcg.createInstance("seller", "prize-1", "test");
    const c1 = await game.createAuction("seller", card.code, 100, 24, null);
    assert.equal(c1.ok, true);
    const notMine = await game.cancelAuction("intruder", c1.id!);
    assert.equal(notMine.ok, false);
    assert.ok((await game.placeBid("a", c1.id!, 100)).ok);
    const hasBid = await game.cancelAuction("seller", c1.id!);
    assert.equal(hasBid.ok, false);
    // Force expiry: the next read settles it — seller paid minus fee,
    // card moves to the top bidder.
    const row = social.auctions.find((a) => a.id === c1.id!)!;
    row.endsAt = new Date(Date.now() - 1000);
    await game.listAuctions();
    assert.equal(row.status, "sold");
    assert.equal(await economy.balance("seller"), 10095);
    assert.equal((await tcg.getInstance(card.code))?.userId, "a");

    const card2 = await tcg.createInstance("seller", "sp-3", "test");
    const c2 = await game.createAuction("seller", card2.code, 100, 24, null);
    assert.ok((await game.cancelAuction("seller", c2.id!)).ok);
  });
});

describe("tournaments", () => {
  test("full 8-player run: bracket locks, matches play, prizes pay out", async () => {
    const { tcg, social, economy, game } = await makeSocial(10000);
    const players = Array.from({ length: 8 }, (_, i) => `p${i + 1}`);
    for (const p of players) await giveValidDeck(tcg, p);
    const created = await game.createTournament("p1", "Giải test", 8, 500);
    assert.equal(created.ok, true);
    const tid = created.id!;
    for (const p of players) {
      assert.ok((await game.joinTournament(p, tid)).ok);
      assert.equal(await economy.balance(p), 9500);
    }
    const detail = await game.tournamentDetail(tid);
    assert.equal(detail?.t.status, "running");
    assert.equal(detail?.matches.length, 4);

    // Play every match until the tournament is done.
    for (let guard = 0; guard < 20; guard++) {
      const matches = await social.listMatches(tid);
      const open = matches.filter((m) => !m.winnerId && m.p1Id && m.p2Id);
      if (!open.length) break;
      for (const m of open) {
        const first = await game.playMatch(m.p1Id!, m.id);
        assert.equal(first.ok, true);
        assert.equal(first.winnerId, undefined); // waiting for opponent
        const second = await game.playMatch(m.p2Id!, m.id);
        assert.equal(second.ok, true);
        assert.ok(second.winnerId);
      }
    }
    const after = await game.tournamentDetail(tid);
    assert.equal(after?.t.status, "done");
    const champion = after?.t.championId;
    assert.ok(champion);
    // Pool = 8 * 500 * 0.9 = 3600 -> 1800 / 1080 / 360 + 360.
    assert.equal(await economy.balance(champion!), 9500 + 1800);
    const payouts = await Promise.all(players.map((p) => economy.balance(p)));
    const total = payouts.reduce((a, b) => a + b, 0);
    assert.equal(total, 8 * 9500 + 3600);
    const prizes = payouts.map((b) => b - 9500).sort((a, b) => b - a);
    assert.deepEqual(prizes, [1800, 1080, 360, 360, 0, 0, 0, 0]);
  });

  test("join rejects an invalid deck and refunds nothing", async () => {
    const { tcg, economy, game } = await makeSocial(10000);
    const created = await game.createTournament("host", "Giải nhỏ", 8, 500);
    const noDeck = await game.joinTournament("lonely", created.id!);
    assert.equal(noDeck.ok, false);
    assert.equal(await economy.balance("lonely"), 10000);
    await giveValidDeck(tcg, "ready");
    assert.ok((await game.joinTournament("ready", created.id!)).ok);
    const twice = await game.joinTournament("ready", created.id!);
    assert.equal(twice.ok, false);
    assert.equal(await economy.balance("ready"), 9500);
  });
});

describe("showcase view", () => {
  test("public, private and missing showcases", async () => {
    const { tcg, social, game } = await makeSocial();
    const card = await tcg.createInstance("owner", "prize-1", "test");
    social.showcases.set("owner", {
      userId: "owner", owned: true, isPublic: true,
      layout: "grid", theme: "classic", effect: "none", pins: [card.code],
    });
    const view = await game.showcaseView("guest", "owner");
    assert.equal(view.state, "ok");
    if (view.state === "ok") {
      assert.equal(view.cards.length, 1);
      assert.equal(view.cards[0].name, "Prize Card");
    }
    social.showcases.set("owner", {
      userId: "owner", owned: true, isPublic: false,
      layout: "grid", theme: "classic", effect: "none", pins: [card.code],
    });
    assert.equal((await game.showcaseView("guest", "owner")).state, "private");
    assert.equal((await game.showcaseView("owner", "owner")).state, "ok");
    assert.equal((await game.showcaseView("guest", "nobody")).state, "none");
  });
});

describe("edition split (spec 6.38)", () => {
  test("validateDeck rejects a mixed EN/JP deck", () => {
    const rules = { size: 30, maxCopies: 3, minSpecies: 10 };
    const en = Array.from({ length: 10 }, (_, i) => `sp-${i + 1}`).flatMap((id) => [id, id, id]);
    assert.equal(deckEdition(en), "en");
    assert.deepEqual(validateDeck(en, rules), []);
    const mixed = [...en.slice(0, 29), "pkmjp-s1"];
    assert.equal(deckEdition(mixed), "mixed");
    assert.ok(validateDeck(mixed, rules).some((e) => e.includes("trộn bản")));
    const jp = Array.from({ length: 10 }, (_, i) => `pkmjp-s${i + 1}`).flatMap((id) => [id, id, id]);
    assert.equal(deckEdition(jp), "jp");
    assert.deepEqual(validateDeck(jp, rules), []);
  });

  test("tournament edition is fixed by the first entrant", async () => {
    const { tcg, social, game } = await makeSocial();
    await giveValidDeck(tcg, "en-player");
    await giveValidDeck(tcg, "jp-player", true);
    const created = await game.createTournament("host", "Edition Cup", 8, 0);
    assert.ok(created.ok && created.id);
    assert.ok((await game.joinTournament("en-player", created.id!)).ok);
    const t = await social.getTournament(created.id!);
    assert.equal(t?.edition, "en");
    const jpJoin = await game.joinTournament("jp-player", created.id!);
    assert.equal(jpJoin.ok, false);
    assert.ok(jpJoin.error?.includes("bản Nhật") || jpJoin.error?.includes("tiếng Anh"));
    // A fresh tournament entered by the JP player first locks to JP.
    const created2 = await game.createTournament("host", "JP Cup", 8, 0);
    assert.ok((await game.joinTournament("jp-player", created2.id!)).ok);
    assert.equal((await social.getTournament(created2.id!))?.edition, "jp");
    const enJoin = await game.joinTournament("en-player", created2.id!);
    assert.equal(enJoin.ok, false);
  });
});
