import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  canPay, parseCost, resistanceCut, simulatePokemonBattle, statusFromEffect,
  weaknessBonus, type PokeFighter,
} from "../src/services/pokemon-battle";

const fighter = (name: string, hp: number, type: string, moves: PokeFighter["moves"], extra: Partial<PokeFighter> = {}): PokeFighter => ({
  speciesId: name.toLowerCase(), name, hp, type, moves, ...extra,
});

describe("pokemon engine helpers", () => {
  test("energy costs: typed letters, digits and C are generic", () => {
    assert.deepEqual(parseCost("2G"), { typed: ["G"], generic: 2, total: 3 });
    assert.deepEqual(parseCost("CCC"), { typed: [], generic: 3, total: 3 });
    assert.equal(canPay(["G", "G", "W"], "2G"), true);
    assert.equal(canPay(["W", "W"], "2G"), false); // no Grass for the typed slot
    assert.equal(canPay(["G"], "G"), true);
    assert.equal(canPay([], "C"), false);
  });

  test("weakness x2 / +30 and resistance -30", () => {
    assert.equal(weaknessBonus("Rx2", "R", 80), 80);
    assert.equal(weaknessBonus("R+30", "R", 80), 30);
    assert.equal(weaknessBonus("Rx2", "W", 80), 0);
    assert.equal(weaknessBonus("None", "R", 80), 0);
    assert.equal(resistanceCut("W-30", "W"), 30);
    assert.equal(resistanceCut("W -30", "R"), 0);
  });

  test("status parsed only when the text targets the defender", () => {
    assert.equal(statusFromEffect("Your opponent's Active Pokemon is now Asleep."), "asleep");
    assert.equal(statusFromEffect("Both this Pokemon and the Defending Pokemon are now Confused."), "confused");
    assert.equal(statusFromEffect("This Pokemon is now Confused."), null);
    assert.equal(statusFromEffect(""), null);
  });
});

describe("pokemon battle simulation", () => {
  const charizard: PokeFighter = fighter("Charizard", 170, "R", [
    { name: "Slash", cost: "CCC", damage: 70 },
    { name: "Fire Spin", cost: "RRCC", damage: 150 },
  ]);
  const blastoise: PokeFighter = fighter("Blastoise", 180, "W", [
    { name: "Hydro Pump", cost: "WWW", damage: 100 },
  ], { weakness: "Lx2" });
  const venusaur: PokeFighter = fighter("Venusaur", 190, "G", [
    { name: "Solar Beam", cost: "GGGC", damage: 130 },
  ], { weakness: "Rx2" });

  test("deterministic: same seed, same outcome", () => {
    const a = simulatePokemonBattle([charizard, venusaur], [blastoise], "seed-1");
    const b = simulatePokemonBattle([charizard, venusaur], [blastoise], "seed-1");
    assert.equal(a.winner, b.winner);
    assert.equal(a.events.length, b.events.length);
    assert.equal(a.turns, b.turns);
  });

  test("weakness doubles damage and prizes end the match", () => {
    // Charizard (R) hits Venusaur (weak Rx2): Slash 70 -> 140.
    const weak: PokeFighter = fighter("Weakmon", 100, "G", [
      { name: "Poke", cost: "C", damage: 10 },
    ], { weakness: "Rx2" });
    const out = simulatePokemonBattle([charizard], [weak], "seed-2");
    const hit = out.events.find((e) => e.type === "attack" && e.attacker === "Charizard");
    assert.equal(hit?.modifier, "weakness");
    assert.equal(hit?.damage, 140);
    assert.equal(out.winner, "a");
    assert.equal(out.prizes[0], 1); // field wipe ends it with 1 prize
  });

  test("energy gates the big move until enough is attached", () => {
    const out = simulatePokemonBattle([charizard], [blastoise], "seed-3");
    const firstFireSpin = out.events.findIndex((e) => e.type === "attack" && e.move === "Fire Spin");
    const firstSlash = out.events.findIndex((e) => e.type === "attack" && e.move === "Slash");
    // Slash costs 3 (turn 3), Fire Spin costs 4 (turn 4 at the earliest).
    assert.ok(firstSlash >= 0);
    assert.ok(firstFireSpin > firstSlash);
    const spinTurn = out.events[firstFireSpin]!.turn;
    assert.ok(spinTurn >= 4, `Fire Spin used on turn ${spinTurn}`);
  });

  test("sleep can steal a turn and poison ticks between turns", () => {
    const sleeper: PokeFighter = fighter("Sleeper", 500, "P", [
      { name: "Hypnosis Wave", cost: "P", damage: 10, effect: "Your opponent's Active Pokemon is now Asleep." },
    ]);
    const victim: PokeFighter = fighter("Victim", 500, "C", [
      { name: "Tackle", cost: "C", damage: 10 },
    ]);
    const out = simulatePokemonBattle([sleeper], [victim], "seed-4");
    assert.ok(out.events.some((e) => e.type === "status-inflicted" && e.status === "asleep"));
    const poisoner: PokeFighter = fighter("Toxmon", 500, "P", [
      { name: "Toxic", cost: "P", damage: 5, effect: "Your opponent's Active Pokemon is now Poisoned." },
    ]);
    const out2 = simulatePokemonBattle([poisoner], [victim], "seed-5");
    assert.ok(out2.events.some((e) => e.type === "status-tick" && e.status === "poisoned"));
  });
});
