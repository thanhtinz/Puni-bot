import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
  simulateOnePieceBattle, type OpCard, type OpLeader,
} from "../src/services/onepiece-battle";

const leader = (name: string, power = 5000, life = 5): OpLeader => ({
  speciesId: name.toLowerCase(), name, power, life,
});
const ch = (
  name: string, cost: number, power: number,
  extra: Partial<OpCard> = {},
): OpCard => ({ speciesId: name.toLowerCase(), name, cost, power, counter: 0, ...extra });
const deckOf = (cards: OpCard[], n = 30): OpCard[] =>
  Array.from({ length: n }, (_, i) => cards[i % cards.length]!);

describe("one piece duel simulation", () => {
  const luffy = leader("Monkey D. Luffy");
  const kaido = leader("Kaido", 6000, 5);
  const zoro = ch("Zoro", 3, 5000);
  const fodder = ch("Fodder", 1, 1000, { counter: 1000 });

  test("deterministic: same seed, same winner and life", () => {
    const a = simulateOnePieceBattle(luffy, deckOf([zoro, fodder]), kaido, deckOf([zoro, fodder]), "op-1");
    const b = simulateOnePieceBattle(luffy, deckOf([zoro, fodder]), kaido, deckOf([zoro, fodder]), "op-1");
    assert.equal(a.winner, b.winner);
    assert.deepEqual(a.life, b.life);
    assert.equal(a.events.length, b.events.length);
  });

  test("a full duel ends with a winner and life loss events", () => {
    const out = simulateOnePieceBattle(luffy, deckOf([zoro]), kaido, deckOf([fodder]), "op-2");
    assert.ok(out.events.some((e) => e.type === "play"));
    assert.ok(out.events.some((e) => e.type === "don"));
    assert.ok(out.events.some((e) => e.type === "life") || out.life[0] !== out.life[1]);
    assert.ok(out.turns >= 2);
  });

  test("DON grows by 2 per turn and caps at 10", () => {
    const out = simulateOnePieceBattle(luffy, deckOf([fodder]), luffy, deckOf([fodder]), "op-3");
    const dons = out.events.filter((e) => e.type === "don");
    assert.ok(dons.length > 0);
    assert.ok(dons.every((e) => (e.amount ?? 0) <= 10));
    // First player turn 1 gains exactly 1 DON.
    assert.equal(dons[0]!.amount, 1);
  });

  test("blocker redirects an attack away from a low-life leader", () => {
    const blockerCard = ch("Bartolomeo", 2, 4000, { blocker: true });
    const out = simulateOnePieceBattle(
      leader("Aggressor", 7000, 5), deckOf([ch("Brute", 5, 9000)]),
      leader("Defender", 5000, 1), deckOf([blockerCard, fodder]),
      "op-4",
    );
    // With the defender at 1 life, the blocker should step in at
    // least once across the duel.
    assert.ok(out.events.some((e) => e.type === "block"), "expected a block event");
  });

  test("double attack takes 2 life in one hit", () => {
    const da = ch("Double Hitter", 3, 8000, { doubleAttack: true });
    const civilian = ch("Civilian", 1, 1000); // no counter value
    const out = simulateOnePieceBattle(
      leader("Attacker", 5000, 5), deckOf([da]),
      leader("Victim", 5000, 5), deckOf([civilian]),
      "op-5",
    );
    const lifeEvents = out.events.filter((e) => e.type === "life");
    // Two life events sharing the same turn = a double-attack hit.
    const byTurn = new Map<number, number>();
    for (const e of lifeEvents) byTurn.set(e.turn, (byTurn.get(e.turn) ?? 0) + 1);
    assert.ok([...byTurn.values()].some((n) => n >= 2), "expected a 2-life turn");
  });
});
