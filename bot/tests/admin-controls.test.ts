/**
 * Owner admin controls wired into the bot: the global on/off switch
 * (maintenance gate) edited from the Admin panel (bot_config).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { CommandRegistry } from "@puni/shared";
import { Dispatcher } from "../src/dispatcher";
import { InMemoryGuildSettings } from "../src/guild-settings";

function fakeRegistry() {
  const registry = new CommandRegistry();
  registry.register({
    name: "ping",
    description: "fake",
    module: "core",
    permission: "everyone",
    slash: true,
    prefix: true,
    handler: async () => ({ text: "pong" }),
  });
  return registry;
}

test("maintenance gate: bot off -> non-owner gets the maintenance reply, owner passes", async () => {
  const settings = new InMemoryGuildSettings();
  let off = true;
  const dispatcher = new Dispatcher(fakeRegistry(), settings, async () => 0, "owner-1", {
    botGate: async () => ({ off, message: "Đang bảo trì nhé!" }),
  });
  const userOut = await dispatcher.dispatchPrefix({
    content: "!ping",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.deepEqual(userOut, { kind: "maintenance", message: "Đang bảo trì nhé!" });

  const ownerOut = await dispatcher.dispatchPrefix({
    content: "!ping",
    userId: "owner-1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(ownerOut.kind, "ok");

  off = false;
  const onOut = await dispatcher.dispatchPrefix({
    content: "!ping",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(onOut.kind, "ok");
});

test("maintenance gate: a failing gate never blocks commands (fail-open)", async () => {
  const settings = new InMemoryGuildSettings();
  const dispatcher = new Dispatcher(fakeRegistry(), settings, async () => 0, "owner-1", {
    botGate: async () => {
      throw new Error("db down");
    },
  });
  const out = await dispatcher.dispatchPrefix({
    content: "!ping",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
  });
  assert.equal(out.kind, "ok");
});
