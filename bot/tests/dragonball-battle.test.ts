import { test } from "node:test";
import assert from "node:assert/strict";
import {
  simulateDragonBallBattle,
  type DbCard,
} from "../src/services/dragonball-battle.js";

const leader = (name: string, power = 15000): DbCard => ({
  speciesId: name, name, cost: 0, power, powerAwake: power + 5000, combo: 0, kind: "Leader",
});
const battle = (name: string, cost: number, power: number, combo = 5000): DbCard => ({
  speciesId: name, name, cost, power, combo, kind: "Battle",
});
const deck = (prefix: string, strong = false): DbCard[] =>
  Array.from({ length: 30 }, (_, i) =>
    battle(`${prefix}${i}`, 1 + (i % 5), strong ? 20000 + i * 500 : 10000 + i * 500),
  );

test("deterministic: same seed, same result", () => {
  const r1 = simulateDragonBallBattle(leader("Goku"), deck("A"), leader("Vegeta"), deck("B"), "seed-1");
  const r2 = simulateDragonBallBattle(leader("Goku"), deck("A"), leader("Vegeta"), deck("B"), "seed-1");
  assert.equal(r1.winner, r2.winner);
  assert.equal(r1.events.length, r2.events.length);
  assert.deepEqual(r1.life, r2.life);
});

test("a battle always produces a winner and a win event", () => {
  const r = simulateDragonBallBattle(leader("Goku"), deck("A"), leader("Vegeta"), deck("B"), "seed-2");
  assert.ok(r.winner === "a" || r.winner === "b");
  assert.equal(r.events[r.events.length - 1]?.type, "win");
  assert.ok(r.turns >= 1 && r.turns <= 40);
});

test("first player never attacks on turn 1", () => {
  const r = simulateDragonBallBattle(leader("Goku"), deck("A", true), leader("Vegeta"), deck("B"), "seed-3");
  const bad = r.events.filter((e) => e.turn === 1 && e.side === "a" && e.type === "attack");
  assert.equal(bad.length, 0);
});

test("stronger deck grinds the enemy life down and awakens happen", () => {
  const r = simulateDragonBallBattle(leader("Goku"), deck("A", true), leader("Vegeta"), deck("B"), "seed-4");
  const lifeHits = r.events.filter((e) => e.type === "life");
  assert.ok(lifeHits.length > 0, "expected leader life losses");
  const awakens = r.events.filter((e) => e.type === "awaken");
  assert.ok(awakens.length >= 1, "expected at least one awaken at <=4 life");
  assert.ok(r.life[0] >= 0 && r.life[1] >= 0);
});

test("life snapshots in events stay within 0..8", () => {
  const r = simulateDragonBallBattle(leader("Goku"), deck("A"), leader("Vegeta"), deck("B"), "seed-5");
  for (const e of r.events) {
    assert.ok(e.lifeA >= 0 && e.lifeA <= 8, `lifeA ${e.lifeA}`);
    assert.ok(e.lifeB >= 0 && e.lifeB <= 8, `lifeB ${e.lifeB}`);
    assert.ok(e.energyMaxA <= 10 && e.energyMaxB <= 10);
  }
});
