import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  simulateYugiohBattle, tributesNeeded, YGO_START_LP, type YgoCard,
} from "../src/services/yugioh-battle";

const card = (name: string, atk: number, def: number, level: number): YgoCard => ({
  speciesId: name.toLowerCase().replace(/\s+/g, "-"), name, atk, def, level,
});
/** A deck of n copies cycling the given cards. */
const deckOf = (cards: YgoCard[], n = 30): YgoCard[] =>
  Array.from({ length: n }, (_, i) => cards[i % cards.length]!);

describe("yugioh helpers", () => {
  test("tribute requirements by level", () => {
    assert.equal(tributesNeeded(4), 0);
    assert.equal(tributesNeeded(5), 1);
    assert.equal(tributesNeeded(6), 1);
    assert.equal(tributesNeeded(7), 2);
    assert.equal(tributesNeeded(12), 2);
  });
});

describe("yugioh duel simulation", () => {
  const bewd = card("Blue-Eyes White Dragon", 3000, 2500, 8);
  const kuriboh = card("Kuriboh", 300, 200, 1);
  const laJinn = card("La Jinn", 1800, 1000, 4);
  const wall = card("Giant Soldier of Stone", 1300, 2000, 3);

  test("deterministic: same seed, same winner and LP", () => {
    const a = simulateYugiohBattle(deckOf([laJinn, kuriboh]), deckOf([wall, kuriboh]), "duel-1");
    const b = simulateYugiohBattle(deckOf([laJinn, kuriboh]), deckOf([wall, kuriboh]), "duel-1");
    assert.equal(a.winner, b.winner);
    assert.deepEqual(a.lp, b.lp);
    assert.equal(a.events.length, b.events.length);
  });

  test("both duelists start at 8000 LP and someone wins", () => {
    const out = simulateYugiohBattle(deckOf([laJinn]), deckOf([kuriboh]), "duel-2");
    assert.equal(YGO_START_LP, 8000);
    assert.equal(out.winner, "a"); // 1800 ATK army steamrolls 300 ATK Kuribohs
    assert.equal(out.lp[1], 0);
    assert.ok(out.events.some((e) => e.type === "direct"));
  });

  test("ATK vs DEF: stronger ATK destroys the wall with no LP damage", () => {
    // B fields only the 2000-DEF wall (DEF >> ATK, so it defends);
    // A's 2500-ATK attacker breaks it — defender destroyed, and the
    // attack itself deals no LP damage (only later direct attacks do).
    const axe = card("Axe Raider EX", 2500, 1200, 5);
    const out = simulateYugiohBattle(deckOf([axe, kuriboh]), deckOf([wall]), "duel-3");
    const wallSummon = out.events.find((e) => e.type === "summon" && e.card === wall.name);
    assert.ok(wallSummon);
    assert.equal(wallSummon!.position, "defense");
    const wallDeath = out.events.findIndex((e) => e.type === "destroy" && e.card === wall.name);
    assert.ok(wallDeath >= 0, "the wall should be destroyed by the 2500 ATK hit");
    // The wall-breaking attack itself must deal no LP damage: the
    // event right after that attack is the destroy, never an lp hit.
    const wallAttack = out.events.findIndex(
      (e) => e.type === "attack" && e.target === wall.name,
    );
    assert.ok(wallAttack >= 0 && wallAttack < wallDeath);
    assert.equal(out.events[wallAttack + 1]!.type, "destroy");
  });

  test("tribute summon: Blue-Eyes needs 2 tributes and arrives", () => {
    const out = simulateYugiohBattle(
      deckOf([bewd, kuriboh, kuriboh, kuriboh, kuriboh, kuriboh]),
      deckOf([kuriboh]),
      "duel-4",
    );
    const summon = out.events.find((e) => e.type === "summon" && e.card === "Blue-Eyes White Dragon");
    assert.ok(summon, "Blue-Eyes should eventually be tribute-summoned");
    const trib = out.events.find((e) => e.type === "tribute" && e.card === "Blue-Eyes White Dragon");
    assert.ok(trib);
    assert.equal(trib!.tributes?.length, 2);
  });

  test("equal ATK destroys both monsters, no LP damage", () => {
    const out = simulateYugiohBattle(deckOf([laJinn]), deckOf([laJinn]), "duel-5");
    // Mirror match: the first clash between two 1800s destroys both.
    const destroys = out.events.filter((e) => e.type === "destroy");
    assert.ok(destroys.length >= 2);
    const firstLp = out.events.find((e) => e.type === "lp");
    if (firstLp) {
      // Any LP loss must come from a later direct attack, not the tie.
      const firstDirect = out.events.findIndex((e) => e.type === "direct");
      assert.ok(out.events.indexOf(firstLp) > firstDirect || firstDirect === -1);
    }
  });
});

test("link monsters: always attack position, never change to defense", () => {
  const linkDeck = Array.from({ length: 12 }, (_, i) => ({
    speciesId: `lk${i}`, name: `Link Spider ${i}`, atk: 1000 + i * 100, def: 0, level: 0, link: true,
  }));
  const wallDeck = Array.from({ length: 12 }, (_, i) => ({
    speciesId: `wl${i}`, name: `Wall ${i}`, atk: 800, def: 3000, level: 4,
  }));
  const r = simulateYugiohBattle(linkDeck, wallDeck, "link-seed");
  const bad = r.events.filter(
    (e) => (e.type === "summon" || e.type === "position") && e.position === "defense" && e.card?.startsWith("Link Spider"),
  );
  assert.equal(bad.length, 0);
});
