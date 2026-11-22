import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  canDigivolve,
  effDp,
  simulateDigimonBattle,
  type DigCard,
} from "../src/services/digimon-battle";

function card(partial: Partial<DigCard> & { name: string }): DigCard {
  return {
    speciesId: partial.name.toLowerCase().replace(/\s+/g, "-"),
    spriteUrl: "",
    level: 3,
    dp: 4000,
    cost: 4,
    evoCost: null,
    evoLevel: null,
    evoColor: null,
    color: "Red",
    blocker: false,
    rush: false,
    enhance: 0,
    ...partial,
  };
}

function deck(prefix: string, strong = false): DigCard[] {
  const cards: DigCard[] = [];
  for (let i = 0; i < 4; i++) cards.push(card({ name: `${prefix} Rookie ${i}`, level: 3, dp: strong ? 5000 : 4000, cost: 3 }));
  for (let i = 0; i < 3; i++) cards.push(card({ name: `${prefix} Baby ${i}`, level: 2, dp: 1000, cost: 0 }));
  for (let i = 0; i < 4; i++) {
    cards.push(card({
      name: `${prefix} Champion ${i}`, level: 4, dp: strong ? 8000 : 7000, cost: 6,
      evoCost: 2, evoLevel: 3, evoColor: "Red",
    }));
  }
  for (let i = 0; i < 3; i++) cards.push(card({ name: `${prefix} Filler ${i}`, level: 3, dp: 3000, cost: 5 }));
  while (cards.length < 30) {
    const n = cards.length;
    cards.push(card({ name: `${prefix} Extra ${n}`, level: 3 + (n % 3), dp: 3000 + (n % 5) * 1000, cost: 3 + (n % 4) }));
  }
  return cards;
}

describe("digimon battle engine", () => {
  test("is deterministic for the same seed", () => {
    const r1 = simulateDigimonBattle(deck("A"), deck("B"), "seed-1");
    const r2 = simulateDigimonBattle(deck("A"), deck("B"), "seed-1");
    assert.equal(r1.winner, r2.winner);
    assert.equal(r1.events.length, r2.events.length);
    assert.equal(r1.turns, r2.turns);
  });

  test("always produces a winner and the gauge stays in range", () => {
    const r = simulateDigimonBattle(deck("A"), deck("B", true), "seed-2");
    assert.ok(["a", "b"].includes(r.winner));
    assert.ok(r.events.some((e) => e.type === "win"));
    assert.ok(r.events.every((e) => e.memory >= -10 && e.memory <= 10));
  });

  test("digivolution requires matching level and colour", () => {
    const base = card({ name: "Agumon", level: 3, color: "Red" });
    const ok = card({ name: "Greymon", level: 4, evoLevel: 3, evoCost: 2, evoColor: "Red" });
    const wrongColor = card({ name: "Garurumon", level: 4, evoLevel: 3, evoCost: 2, evoColor: "Blue" });
    const wrongLevel = card({ name: "MetalGreymon", level: 5, evoLevel: 4, evoCost: 3, evoColor: "Red" });
    const multi = card({ name: "Multi Base", level: 3, color: "Red;White" });
    assert.equal(canDigivolve(ok, base), true);
    assert.equal(canDigivolve(wrongColor, base), false);
    assert.equal(canDigivolve(wrongLevel, base), false);
    assert.equal(canDigivolve(ok, multi), true);
  });

  test("enhance raises DP by 500 per level", () => {
    assert.equal(effDp(card({ name: "X", dp: 4000, enhance: 3 })), 5500);
  });

  test("a stronger deck wins more often than not", () => {
    let wins = 0;
    for (let i = 0; i < 12; i++) {
      const r = simulateDigimonBattle(deck("S", true), deck("W"), `seed-x-${i}`);
      if (r.winner === "a") wins += 1;
    }
    assert.ok(wins >= 7, `strong deck won only ${wins}/12`);
  });
});
