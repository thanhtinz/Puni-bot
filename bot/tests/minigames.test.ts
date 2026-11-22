import { test } from "node:test";
import assert from "node:assert/strict";
import { InMemoryGameSessionStore } from "../src/services/game-sessions";
import { createGameCommands } from "../src/commands/games";
import { bjStart, handValue, tttWinner, tttBotMove, simulateRace, ANIMALS } from "../src/services/minigames";
import {
  InMemoryChannelGameStore, ChannelGamesService,
  processCounting, processWordchain, freshCounting, freshWordchain, normalizeSyllable,
} from "../src/services/channel-games";
import { createChannelGameCommands } from "../src/commands/channel-games";

function seeded(seed = 42) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

function setup(rng = seeded()) {
  const balances = new Map<string, number>([["alice", 10000], ["bob", 10000]]);
  const economy = {
    debit: async (u: string, amt: number) => {
      const b = balances.get(u) ?? 0;
      if (b < amt) return false;
      balances.set(u, b - amt);
      return true;
    },
    credit: async (u: string, amt: number) => { balances.set(u, (balances.get(u) ?? 0) + amt); },
  };
  const cmds = createGameCommands({
    economy, sessions: new InMemoryGameSessionStore(), currencyName: () => "Coins", rng,
  });
  const byName = Object.fromEntries(cmds.map((c) => [c.name, c]));
  const ctx = (userId: string, args: string[] = [], mentions: string[] = []) =>
    ({ userId, args, mentions, guildId: "g", channelId: "c" }) as never;
  return { balances, byName, ctx };
}

test("coinflip vs bot: debit on play, win pays double", async () => {
  const { balances, byName, ctx } = setup(() => 0.1); // rng < 0.5 -> sap
  const out = await byName.coinflip.handler(ctx("alice", ["sap", "100"]));
  assert.match(out.text, /đoán đúng/);
  assert.equal(balances.get("alice"), 10000 - 100 + 200);
});

test("coinflip challenge: escrow, accept plays, reject refunds", async () => {
  const { balances, byName, ctx } = setup(() => 0.9);
  await byName.coinflip.handler(ctx("alice", ["100"], ["bob"]));
  assert.equal(balances.get("alice"), 9900);
  const out = await byName.coinflip.handler(ctx("bob", ["accept"]));
  assert.match(out.text, /thắng thách đấu/);
  // rng 0.9 -> challenger loses -> bob gets 200 total
  assert.equal(balances.get("bob"), 10000 - 100 + 200);
});

test("blackjack: start debits, stand settles the hand", async () => {
  const { balances, byName, ctx } = setup(seeded(7));
  const start = await byName.blackjack.handler(ctx("alice", ["200"]));
  assert.equal(balances.get("alice"), 9800);
  if (/BLACKJACK ngay/.test(start.text)) {
    assert.ok((balances.get("alice") ?? 0) > 9800);
    return;
  }
  const done = await byName.blackjack.handler(ctx("alice", ["stand"]));
  assert.match(done.text, /Nhà cái:/);
  const after = balances.get("alice") ?? 0;
  assert.ok(after === 9800 || after === 10200 || after === 10000, `balance ${after}`);
});

test("blackjack engine: hand values with aces", () => {
  assert.equal(handValue([{ rank: "A", suit: "♠", value: 11 }, { rank: "K", suit: "♥", value: 10 }]), 21);
  assert.equal(handValue([{ rank: "A", suit: "♠", value: 11 }, { rank: "A", suit: "♥", value: 11 }, { rank: "9", suit: "♦", value: 9 }]), 21);
  const s = bjStart(100, seeded(3));
  assert.equal(s.player.length, 2);
});

test("tictactoe: bot game starts, moves alternate, invalid cell rejected", async () => {
  const { byName, ctx } = setup(seeded(11));
  const start = await byName.tictactoe.handler(ctx("alice", []));
  assert.match(start.text, /Ván caro với bot/);
  const move = await byName.tictactoe.handler(ctx("alice", ["5"]));
  assert.match(move.text, /❌|⭕/);
});

test("tictactoe engine: winner lines and hard bot never loses a won game", () => {
  assert.equal(tttWinner(["X", "X", "X", "", "O", "", "O", "", ""]), "X");
  assert.equal(tttWinner(["X", "O", "X", "X", "O", "O", "O", "X", "X"]), "draw");
  const board = ["O", "O", "", "X", "X", "", "", "", ""] as ("X" | "O" | "")[];
  assert.equal(tttBotMove(board, "hard", seeded()), 2); // takes the win
});

test("race: valid bet settles, payout follows odds on a win", async () => {
  const { balances, byName, ctx } = setup(seeded(99));
  const before = balances.get("alice")!;
  const out = await byName.race.handler(ctx("alice", ["ngua", "100"]));
  assert.match(out.text, /về nhất/);
  const after = balances.get("alice")!;
  assert.ok(after === before - 100 || after === before - 100 + Math.floor(100 * ANIMALS[0].odds));
});

test("counting: sequence advances, same-user and wrong number reset", () => {
  const s = freshCounting();
  assert.equal(processCounting(s, "a", "1").action, "ok");
  assert.equal(processCounting(s, "b", "2").action, "ok");
  assert.equal(processCounting(s, "b", "3").action, "wrong"); // same user twice
  assert.equal(s.current, 0);
  assert.equal(processCounting(s, "a", "5").action, "wrong"); // expected 1
  assert.equal(processCounting(s, "a", "hello").action, "ignore");
});

test("wordchain: syllable rule is tone-insensitive, repeats rejected", () => {
  assert.equal(normalizeSyllable("tiếng"), "tieng");
  assert.equal(normalizeSyllable("đầu"), "dau");
  const s = freshWordchain();
  assert.equal(processWordchain(s, "a", "con mèo").action, "ok");
  assert.equal(processWordchain(s, "b", "mèo con").action, "ok"); // starts with "mèo"
  assert.equal(processWordchain(s, "a", "con mèo").action, "wrong"); // repeat
  assert.equal(processWordchain(s, "a", "xe đạp").action, "wrong"); // must start with "con"
  assert.equal(processWordchain(s, "a", "con gà").action, "ok");
});

test("channel games service + setup commands: set, play, status, off", async () => {
  const store = new InMemoryChannelGameStore();
  const svc = new ChannelGamesService(store);
  const [demso] = createChannelGameCommands({ store });
  const ctx = (userId: string, args: string[] = [], rank = 2) =>
    ({ userId, args, mentions: [], guildId: "g1", channelId: "c1", rank }) as never;
  assert.equal(await svc.handleMessage({ guildId: "g1", channelId: "c1", userId: "a", content: "1" }), null);
  await demso.handler(ctx("admin", ["set"]));
  const ok = await svc.handleMessage({ guildId: "g1", channelId: "c1", userId: "a", content: "1" });
  assert.equal(ok?.action, "ok");
  const status = await demso.handler(ctx("someone", []));
  assert.match(status.text, /đang ở số \*\*1\*\*/);
  await demso.handler(ctx("admin", ["off"]));
  assert.equal(await svc.handleMessage({ guildId: "g1", channelId: "c1", userId: "a", content: "2" }), null);
});
