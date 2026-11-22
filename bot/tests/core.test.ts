import { test } from "node:test";
import assert from "node:assert/strict";
import { CommandRegistry, REACTIONS, getReaction } from "@puni/shared";
import { parsePrefixMessage, Dispatcher } from "../src/dispatcher";
import { InMemoryGuildSettings } from "../src/guild-settings";
import { EconomyService, InsufficientFundsError } from "../src/services/economy";
import { buildBot } from "../src/registry";
import { buildSlashPayload } from "../src/client";

test("reactions: exactly 69, kiss template matches the approved spec example", () => {
  assert.equal(REACTIONS.length, 69);
  const kiss = getReaction("kiss");
  assert.ok(kiss);
  assert.equal(kiss.tagText, "{người gửi} đã gửi nụ hôn đến {người nhận}");
  assert.ok(getReaction("KISS"), "lookup is case-insensitive");
});

test("registry: core + reactions + economy assembled without collisions", () => {
  const settings = new InMemoryGuildSettings();
  const { registry } = buildBot({ settings });
  // slash: 4 core + reaction + 4 economy + pass + orders + vote + 13 tcg + 3 case commands + 5 enforcement
  assert.equal(registry.slashCommands().length, 33);
  // prefix: 4 core + 69 reactions + 4 economy + pass + orders + vote + 13 tcg + 3 case commands + 5 enforcement
  assert.equal(registry.prefixCommands().length, 101);
  assert.equal(registry.resolve("bal")?.name, "balance");
  assert.equal(registry.resolve("kiss")?.module, "reaction");
});

test("parsePrefixMessage: prefix required, mentions extracted", () => {
  assert.deepEqual(parsePrefixMessage("!kiss <@123>", "!"), {
    name: "kiss",
    args: ["<@123>"],
    mentions: ["123"],
  });
  assert.equal(parsePrefixMessage("kiss <@123>", "!"), null);
  assert.equal(parsePrefixMessage("!", "!"), null);
  assert.equal(parsePrefixMessage("?ping", "!"), null);
  assert.equal(parsePrefixMessage("?ping", "?")?.name, "ping");
});

test("module switch: a command in a disabled module behaves as nonexistent", async () => {
  const registry = new CommandRegistry();
  registry.register({
    name: "coinflip",
    description: "fake games command",
    module: "games",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async () => ({ text: "ok" }),
  });
  const settings = new InMemoryGuildSettings();
  const dispatcher = new Dispatcher(registry, settings, async () => 0, "owner-1");
  await settings.set("g1", { modules: { games: false } });
  const before = await dispatcher.dispatchPrefix({
    content: "!coinflip",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(before.kind, "ignored");
  await settings.set("g1", { modules: { games: true } });
  const after = await dispatcher.dispatchPrefix({
    content: "!coinflip",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(after.kind, "ok");
});

test("public command list shows only everyone-permission commands (commands page law)", () => {
  const registry = new CommandRegistry();
  registry.register({
    name: "ban",
    description: "fake mod command",
    module: "moderation",
    permission: "mod",
    slash: true,
    prefix: true,
    handler: async () => ({ text: "ok" }),
  });
  registry.register({
    name: "ping",
    description: "core",
    module: "core",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async () => ({ text: "pong" }),
  });
  assert.deepEqual(registry.publicCommands().map((c) => c.name), ["ping"]);
});

test("permission gate: owner-only command rejects members, accepts the bot owner", async () => {
  const registry = new CommandRegistry();
  registry.register({
    name: "infra",
    description: "owner infra",
    module: "core",
    permission: "owner",
    slash: true,
    prefix: true,
    handler: async () => ({ text: "secret" }),
  });
  const settings = new InMemoryGuildSettings();
  const dispatcher = new Dispatcher(registry, settings, async () => 0, "owner-1");
  const member = await dispatcher.dispatchPrefix({
    content: "!infra",
    userId: "u9",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(member.kind, "forbidden");
  const owner = await dispatcher.dispatchPrefix({
    content: "!infra",
    userId: "owner-1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(owner.kind, "ok");
});

test("cooldown gate: second call inside the window is throttled", async () => {
  const registry = new CommandRegistry();
  registry.register({
    name: "hug",
    description: "reaction-like",
    module: "reaction",
    permission: "everyone",
    slash: false,
    prefix: true,
    cooldownSec: 3,
    handler: async () => ({ text: "hug" }),
  });
  const settings = new InMemoryGuildSettings();
  let now = 1_000_000;
  const dispatcher = new Dispatcher(registry, settings, async () => 0, "owner-1", { now: () => now });
  const first = await dispatcher.dispatchPrefix({ content: "!hug", userId: "u1", guildId: "g1", channelId: "c1" });
  assert.equal(first.kind, "ok");
  const second = await dispatcher.dispatchPrefix({ content: "!hug", userId: "u1", guildId: "g1", channelId: "c1" });
  assert.equal(second.kind, "cooldown");
  now += 3001;
  const third = await dispatcher.dispatchPrefix({ content: "!hug", userId: "u1", guildId: "g1", channelId: "c1" });
  assert.equal(third.kind, "ok");
});

test("economy: debit fails closed, transfer is atomic", async () => {
  const eco = new EconomyService();
  await eco.credit("u1", 100, "test");
  assert.equal(await eco.getBalance("u1"), 100);
  await assert.rejects(() => eco.debit("u1", 150, "test"), InsufficientFundsError);
  assert.equal(await eco.getBalance("u1"), 100, "failed debit must not change the balance");
  await assert.rejects(() => eco.transfer("u1", "u2", 150), InsufficientFundsError);
  assert.equal(await eco.getBalance("u2"), 0, "failed transfer must not credit the receiver");
  await eco.transfer("u1", "u2", 40);
  assert.equal(await eco.getBalance("u1"), 60);
  assert.equal(await eco.getBalance("u2"), 40);
  // u1 ledger: the credit + the successful transfer-out = 2 entries.
  // The failed debit and failed transfer wrote NOTHING (fail-closed).
  assert.equal((await eco.ledgerFor("u1")).length, 2, "only successful mutations reach the ledger");
  assert.equal((await eco.ledgerFor("u2")).length, 1);
});

test("economy daily: once per global day, streak grows then resets", async () => {
  const eco = new EconomyService();
  const d1 = new Date("2026-01-01T12:00:00Z");
  const first = await eco.claimDaily("u1", d1);
  assert.deepEqual(first, { amount: 100, streak: 1 });
  const again = await eco.claimDaily("u1", new Date("2026-01-01T23:59:00Z"));
  assert.equal(again, null, "second claim on the same global day is refused");
  const d2 = await eco.claimDaily("u1", new Date("2026-01-02T00:01:00Z"));
  assert.deepEqual(d2, { amount: 110, streak: 2 });
  const d4 = await eco.claimDaily("u1", new Date("2026-01-04T00:01:00Z"));
  assert.deepEqual(d4, { amount: 100, streak: 1 }, "a skipped day resets the streak");
});

test("slash payload: every slash command is in the global registration", () => {
  const settings = new InMemoryGuildSettings();
  const { registry } = buildBot({ settings });
  const payload = buildSlashPayload(registry);
  assert.equal(payload.length, registry.slashCommands().length);
  const reaction = payload.find((p) => p.name === "reaction");
  assert.ok(reaction, "grouped /reaction exists");
});
