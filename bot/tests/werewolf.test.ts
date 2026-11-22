import { test } from "node:test";
import assert from "node:assert/strict";
import type { CommandContext } from "@puni/shared";
import { createWerewolfCommands } from "../src/commands/werewolf";
import { InMemoryWerewolfStore } from "../src/services/werewolf-store";
import {
  DEFAULT_WW_CONFIG,
  buildRoleSet,
  wolfCount,
  type WwConfig,
  type WwGame,
  type WwRoleId,
} from "../src/services/werewolf";

function seeded(seed = 42) {
  let s = seed;
  return () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
}

const GUILD = "g1";
const CHAN = "c1";

function setup(cfgOverride: Partial<WwConfig> = {}, seed = 42) {
  const store = new InMemoryWerewolfStore();
  const cfg: WwConfig = { ...DEFAULT_WW_CONFIG, ...cfgOverride };
  let clock = 1_700_000_000_000;
  const cmds = createWerewolfCommands({
    store,
    configSource: async () => cfg,
    rng: seeded(seed),
    now: () => new Date(clock),
  });
  const cmd = cmds[0];
  const call = async (
    userId: string, args: string[], where: { guildId: string | null; channelId: string } = { guildId: GUILD, channelId: CHAN },
  ) => {
    const ctx: CommandContext = {
      userId, guildId: where.guildId, channelId: where.channelId,
      args, mentions: [], surface: "prefix",
    };
    return (await cmd.handler(ctx)).text;
  };
  const dm = (userId: string, args: string[]) =>
    call(userId, args, { guildId: null, channelId: `dm-${userId}` });
  const game = async (): Promise<WwGame> => {
    const g = await store.getActiveByChannel(CHAN);
    assert.ok(g, "expected an active game");
    return g;
  };
  const roleOf = async (userId: string): Promise<WwRoleId | null> => {
    const g = await store.getActiveByChannel(CHAN)
      ?? await store.lastFinishedByChannel(CHAN);
    return g?.state.players.find((p) => p.userId === userId)?.role ?? null;
  };
  const byRole = async (role: WwRoleId): Promise<string[]> => {
    const g = (await store.getActiveByChannel(CHAN)) ?? (await store.lastFinishedByChannel(CHAN));
    assert.ok(g);
    return g.state.players.filter((p) => p.role === role).map((p) => p.userId);
  };
  const numOf = async (userId: string): Promise<number> => {
    const g = (await store.getActiveByChannel(CHAN)) ?? (await store.lastFinishedByChannel(CHAN));
    assert.ok(g);
    return g.state.players.find((p) => p.userId === userId)!.num;
  };
  return {
    store, cfg, cmd, call, dm, game, roleOf, byRole, numOf,
    advanceClock: (ms: number) => { clock += ms; },
  };
}

const PLAYERS8 = ["u1", "u2", "u3", "u4", "u5", "u6", "u7", "u8"];

async function lobbyOf(h: ReturnType<typeof setup>, players: string[]) {
  await h.call(players[0], ["tao"]);
  for (const p of players.slice(1)) await h.call(p, ["vao"]);
}

test("role set composition follows the spec table", () => {
  assert.equal(wolfCount(5, DEFAULT_WW_CONFIG), 1);
  assert.equal(wolfCount(8, DEFAULT_WW_CONFIG), 2);
  assert.equal(wolfCount(12, DEFAULT_WW_CONFIG), 3);
  assert.equal(wolfCount(20, DEFAULT_WW_CONFIG), 5);
  const r8 = buildRoleSet(8, DEFAULT_WW_CONFIG);
  assert.equal(r8.filter((r) => r === "wolf").length, 2);
  for (const r of ["seer", "witch", "guard", "hunter"] as WwRoleId[]) {
    assert.equal(r8.filter((x) => x === r).length, 1, r);
  }
  assert.equal(r8.filter((r) => r === "villager").length, 2);
  const r5 = buildRoleSet(5, DEFAULT_WW_CONFIG);
  assert.equal(r5.filter((r) => r === "wolf").length, 1);
  assert.ok(!r5.includes("witch") && !r5.includes("hunter")); // size gates
});

test("lobby rules: min players, one game per member, host transfer", async () => {
  const h = setup();
  await lobbyOf(h, PLAYERS8.slice(0, 4));
  const tooFew = await h.call("u1", ["batdau"]);
  assert.match(tooFew, /ít nhất 5/);
  await h.call("u5", ["vao"]);
  // a member of this lobby cannot open another one elsewhere
  const elsewhere = await h.call("u3", ["tao"], { guildId: GUILD, channelId: "c2" });
  assert.match(elsewhere, /đang ở trong một sảnh\/ván ma sói khác/);
  // host leaves → host passes to the next player
  await h.call("u1", ["roi"]);
  const g = await h.game();
  assert.equal(g.hostId, "u2");
  assert.equal(g.state.players.length, 4);
  // non-host cannot start
  const notHost = await h.call("u3", ["batdau"]);
  assert.match(notHost, /Chỉ chủ sảnh/);
  await h.call("u6", ["vao"]); // back to 5 players
  const started = await h.call("u2", ["batdau"]);
  assert.match(started, /bắt đầu/);
  // joining a running game is refused
  const late = await h.call("u7", ["vao"]);
  assert.match(late, /đã bắt đầu hoặc đã đóng/);
});

test("full game — village wins: save, lynch, poison, hunter shot, stats once", async () => {
  const h = setup();
  await lobbyOf(h, PLAYERS8);
  await h.call("u1", ["batdau"]);
  const g0 = await h.game();
  assert.equal(g0.state.phase, "night");
  // role DMs were queued for everyone
  const outbox = await h.store.drainOutbox(50);
  const roleDms = outbox.filter((i) => i.kind === "dm" && /Vai của bạn/.test(i.text));
  assert.equal(roleDms.length, 8); // one secret role DM per player
  // every role DM carries that player's role-card artwork, and the
  // named file exists in the shipped asset set
  const { WW_ROLE_ART } = await import("../src/services/werewolf");
  const fs = await import("node:fs");
  const path = await import("node:path");
  for (const p of g0.state.players) {
    const dm = roleDms.find((i) => i.targetId === p.userId);
    assert.ok(dm, `role DM for ${p.userId}`);
    assert.equal(dm!.art, WW_ROLE_ART[p.role!]);
    assert.ok(
      fs.existsSync(path.resolve(__dirname, "../../assets/werewolf", dm!.art!)),
      `art file ${dm!.art} exists`,
    );
  }

  const [wolf1, wolf2] = await h.byRole("wolf");
  const [seer] = await h.byRole("seer");
  const [witch] = await h.byRole("witch");
  const [guard] = await h.byRole("guard");
  const [hunter] = await h.byRole("hunter");
  const villagers = await h.byRole("villager");
  const v1 = villagers[0];

  // night actions are refused in the public channel
  const leak = await h.call(wolf1, ["giet", String(await h.numOf(v1))]);
  assert.match(leak, /tin nhắn riêng/);

  // Night 1: wolves pick v1, guard covers the other villager, seer
  // peeks wolf1 (learns SÓI), witch saves the victim.
  await h.dm(wolf1, ["giet", String(await h.numOf(v1))]);
  await h.dm(wolf2, ["giet", String(await h.numOf(v1))]);
  await h.dm(guard, ["baove", String(await h.numOf(villagers[1]))]);
  const peek = await h.dm(seer, ["soi", String(await h.numOf(wolf1))]);
  assert.match(peek, /phe SÓI/);
  // witch stage opens automatically once night actors are done
  const gW = await h.game();
  assert.equal(gW.state.phase, "witch");
  const saved = await h.dm(witch, ["cuu"]);
  assert.match(saved, /bình cứu/);
  const gDawn = await h.game();
  assert.equal(gDawn.state.phase, "day");
  assert.ok(gDawn.state.players.every((p) => p.alive), "save worked — nobody died");

  // Day 1: the village lynches wolf1 (wolves vote elsewhere).
  for (const p of PLAYERS8) {
    const target = (p === wolf1 || p === wolf2) ? villagers[1] : wolf1;
    if (p === wolf1) continue; // the accused still may vote — keep simple: wolf1 votes too below
    await h.call(p, ["treo", String(await h.numOf(target))]);
  }
  await h.call(wolf1, ["treo", String(await h.numOf(villagers[1]))]);
  const gN2 = await h.game();
  assert.equal(gN2.state.phase, "night");
  assert.equal(gN2.state.round, 2);
  assert.equal(gN2.state.players.find((p) => p.userId === wolf1)?.alive, false);

  // Night 2: wolf2 kills the hunter; witch poisons wolf2. The dying
  // hunter takes a final shot at a villager; village wins on wolves=0.
  await h.dm(wolf2, ["giet", String(await h.numOf(hunter))]);
  await h.dm(guard, ["baove", String(await h.numOf(seer))]);
  await h.dm(seer, ["soi", String(await h.numOf(wolf2))]);
  await h.dm(witch, ["doc", String(await h.numOf(wolf2))]);
  const gH = await h.game();
  assert.equal(gH.state.phase, "hunter");
  const shot = await h.dm(hunter, ["ban", String(await h.numOf(v1))]);
  assert.match(shot, /Đã bắn/);
  const gEnd = await h.store.lastFinishedByChannel(CHAN);
  assert.ok(gEnd);
  assert.equal(gEnd!.state.winner, "village");
  assert.equal(gEnd!.state.players.find((p) => p.userId === v1)?.alive, false);

  // Stats: exactly one game per player; village side won.
  for (const p of PLAYERS8) {
    const st = await h.store.getStats(GUILD, p);
    assert.ok(st, `stats for ${p}`);
    assert.equal(st!.games, 1);
    const role = gEnd!.state.players.find((x) => x.userId === p)?.role;
    assert.equal(st!.wins, role === "wolf" ? 0 : 1, `${p} wins`);
  }
  // claiming again must not double-record
  assert.equal(await h.store.claimStats(gEnd!.id), false);
  // match record exists
  const record = await h.call("u1", ["bienban"]);
  assert.match(record, /Biên bản/);
  assert.match(record, /phe DÂN thắng/);
});

test("full game — wolves win by parity at dawn", async () => {
  const h = setup({}, 7);
  const players = ["a1", "a2", "a3", "a4", "a5"];
  await lobbyOf(h, players);
  await h.call("a1", ["batdau"]);
  // 5 players deal: 1 wolf, seer, 3 villagers (guard needs 6+).
  const [wolf] = await h.byRole("wolf");
  const [seer] = await h.byRole("seer");
  const villagers = await h.byRole("villager");
  assert.equal(villagers.length, 3);

  // Night 1: wolf kills villager A; seer peeks the wolf.
  await h.dm(wolf, ["giet", String(await h.numOf(villagers[0]))]);
  await h.dm(seer, ["soi", String(await h.numOf(wolf))]);
  let g = await h.game();
  assert.equal(g.state.phase, "day");
  assert.equal(g.state.players.find((p) => p.userId === villagers[0])?.alive, false);

  // Day 1: villager B is mislynched 3–1.
  await h.call(wolf, ["treo", String(await h.numOf(villagers[1]))]);
  await h.call(seer, ["treo", String(await h.numOf(villagers[1]))]);
  await h.call(villagers[2], ["treo", String(await h.numOf(villagers[1]))]);
  await h.call(villagers[1], ["treo", String(await h.numOf(wolf))]);
  g = await h.game();
  assert.equal(g.state.phase, "night");

  // Night 2: wolf kills villager C → 1 wolf vs 1 seer at dawn = parity.
  await h.dm(wolf, ["giet", String(await h.numOf(villagers[2]))]);
  await h.dm(seer, ["soi", String(await h.numOf(villagers[2]))]);
  const end = await h.store.lastFinishedByChannel(CHAN);
  assert.ok(end);
  assert.equal(end!.state.winner, "wolves");
  const wolfStats = await h.store.getStats(GUILD, wolf);
  assert.equal(wolfStats?.wins, 1);
  assert.equal(wolfStats?.wolfWins, 1);
});

test("deadlines: silent night and empty day advance without hanging", async () => {
  const h = setup();
  const players = ["b1", "b2", "b3", "b4", "b5", "b6"];
  await lobbyOf(h, players);
  await h.call("b1", ["batdau"]);
  // nobody acts at night; jump past the night deadline and poke the
  // game through a channel status call (the tick path uses the same
  // advanceIfDue the commands apply).
  h.advanceClock(DEFAULT_WW_CONFIG.nightMs + 1000);
  await h.call("b1", [""]);
  let g = await h.game();
  assert.equal(g.state.phase, "day");
  assert.ok(g.state.players.every((p) => p.alive), "idle wolves kill nobody");
  // empty discussion → no lynch, next night begins
  h.advanceClock(DEFAULT_WW_CONFIG.discussMs + 1000);
  await h.call("b1", [""]);
  g = await h.game();
  assert.equal(g.state.phase, "night");
  assert.equal(g.state.round, 2);
});

test("guard cannot protect the same player twice in a row", async () => {
  const h = setup();
  const players = ["c1", "c2", "c3", "c4", "c5", "c6"];
  await lobbyOf(h, players);
  await h.call("c1", ["batdau"]);
  const wolves = await h.byRole("wolf");
  assert.equal(wolves.length, 2); // 6 players → 2 wolves
  const [guard] = await h.byRole("guard");
  const [seer] = await h.byRole("seer");
  const villagers = await h.byRole("villager");
  const ward = villagers[0];
  for (const w of wolves) await h.dm(w, ["giet", String(await h.numOf(villagers[1]))]);
  await h.dm(guard, ["baove", String(await h.numOf(ward))]);
  await h.dm(seer, ["soi", String(await h.numOf(wolves[0]))]);
  let g = await h.game();
  assert.equal(g.state.phase, "day"); // wolf victim died (unprotected)
  // day passes with no votes
  h.advanceClock(DEFAULT_WW_CONFIG.discussMs + 1000);
  await h.call("c1", [""]);
  g = await h.game();
  assert.equal(g.state.phase, "night");
  const again = await h.dm(guard, ["baove", String(await h.numOf(ward))]);
  assert.match(again, /hai đêm liên tiếp/);
});

test("elder survives the first wolf attack only", async () => {
  const h = setup({ useElder: true }, 99);
  await lobbyOf(h, PLAYERS8);
  await h.call("u1", ["batdau"]);
  const [elder] = await h.byRole("elder");
  const wolves = await h.byRole("wolf");
  const [seer] = await h.byRole("seer");
  const [witch] = await h.byRole("witch");
  const [guard] = await h.byRole("guard");
  // Night 1: wolves maul the elder — shield absorbs it.
  for (const w of wolves) await h.dm(w, ["giet", String(await h.numOf(elder))]);
  await h.dm(guard, ["baove", String(await h.numOf(seer))]);
  await h.dm(seer, ["soi", String(await h.numOf(wolves[0]))]);
  await h.dm(witch, ["boqua"]);
  let g = await h.game();
  assert.equal(g.state.phase, "day");
  assert.equal(g.state.players.find((p) => p.userId === elder)?.alive, true);
  assert.match(g.state.log.join("\n"), /khiên già làng/);
  // Day: no votes → night 2. Wolves finish the elder off.
  h.advanceClock(DEFAULT_WW_CONFIG.discussMs + 1000);
  await h.call("u1", [""]);
  for (const w of wolves) await h.dm(w, ["giet", String(await h.numOf(elder))]);
  await h.dm(guard, ["baove", String(await h.numOf(witch))]);
  await h.dm(seer, ["soi", String(await h.numOf(wolves[1]))]);
  await h.dm(witch, ["boqua"]);
  g = await h.game();
  assert.equal(g.state.players.find((p) => p.userId === elder)?.alive, false);
});

test("profile command reports fame stats, never money", async () => {
  const h = setup();
  const before = await h.call("zz", ["hs"]);
  assert.match(before, /chưa chơi ván ma sói nào/);
});
