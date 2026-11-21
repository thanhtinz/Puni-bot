import { test } from "node:test";
import assert from "node:assert/strict";
import { checkAutomod } from "../src/services/automod";
import { LogService } from "../src/services/logging";
import { InMemoryGuildSettings } from "../src/guild-settings";
import { normalizeAutomodConfig, normalizeLogConfig } from "../src/moderation-config";
import { parseDuration, formatDuration } from "../src/services/enforcement";
import { Dispatcher } from "../src/dispatcher";
import { buildBot } from "../src/registry";
import type { Enforcer } from "../src/services/enforcement";

test("duration parsing: units, caps, junk", () => {
  assert.equal(parseDuration("30s"), 30);
  assert.equal(parseDuration("10m"), 600);
  assert.equal(parseDuration("2h"), 7200);
  assert.equal(parseDuration("1d"), 86400);
  assert.equal(parseDuration("0m"), null);
  assert.equal(parseDuration("10"), null);
  assert.equal(parseDuration("abc"), null);
  assert.equal(formatDuration(7200), "2 giờ");
  assert.equal(formatDuration(600), "10 phút");
});

test("automod: blocked word / link / caps, staff exempt, disabled passes", () => {
  const cfg = normalizeAutomodConfig({
    enabled: true,
    blockedWords: ["badword"],
    blockLinks: true,
    capsRatio: 0.7,
    capsMinLength: 10,
  });
  assert.equal(checkAutomod(cfg, { content: "hello BADWORD here", authorRank: 0 }).action, "delete");
  assert.equal(checkAutomod(cfg, { content: "see https://x.example", authorRank: 0 }).action, "delete");
  assert.equal(checkAutomod(cfg, { content: "HELLO EVERYONE THIS IS CAPS", authorRank: 0 }).action, "delete");
  assert.deepEqual(checkAutomod(cfg, { content: "badword", authorRank: 1 }), { action: "none" }, "staff exempt");
  assert.deepEqual(checkAutomod(cfg, { content: "xin chào mọi người", authorRank: 0 }), { action: "none" });
  const off = normalizeAutomodConfig({ enabled: false, blockedWords: ["badword"] });
  assert.deepEqual(checkAutomod(off, { content: "badword", authorRank: 0 }), { action: "none" });
});

test("log service: master switch, channel, and per-group toggles all gate delivery", async () => {
  const settings = new InMemoryGuildSettings();
  const sent: string[] = [];
  const logs = new LogService(settings, {
    send: async (_channelId, text) => {
      sent.push(text);
    },
  });
  assert.equal(await logs.log("g1", "messages", "x"), false, "disabled by default");
  const s = await settings.get("g1");
  await settings.set("g1", { logging: { ...s.logging, enabled: true, channelId: "c-log" } });
  assert.equal(await logs.log("g1", "messages", "hello"), true);
  const s2 = await settings.get("g1");
  await settings.set("g1", {
    logging: { ...s2.logging, groups: { ...s2.logging.groups, messages: false } },
  });
  assert.equal(await logs.log("g1", "messages", "muted group"), false);
  assert.equal(await logs.log("g1", "members", "still on"), true);
  assert.deepEqual(sent, ["hello", "still on"]);
  const normalized = normalizeLogConfig({ groups: { channels: false } });
  assert.equal(normalized.groups.channels, false);
  assert.equal(normalized.groups.messages, true);
});

test("enforcement: mute writes case + calls enforcer; failure closes the case", async () => {
  const settings = new InMemoryGuildSettings();
  const { registry, cases, enforcer } = buildBot({ settings });
  const calls: string[] = [];
  const fake: Enforcer = {
    async timeout(_g, u, d) {
      calls.push(`timeout:${u}:${d}`);
    },
    async removeTimeout() {},
    async kick() {},
    async ban() {
      throw new Error("Missing Permissions");
    },
    async unban() {},
  };
  enforcer.bind(fake);
  const dispatcher = new Dispatcher(registry, settings, async () => 0, "owner-1");

  const muted = await dispatcher.dispatchPrefix({
    content: "!mute <@777> 10m spam",
    userId: "u-mod",
    guildId: "g1",
    channelId: "c1",
    rank: 1,
  });
  assert.equal(muted.kind, "ok");
  assert.deepEqual(calls, ["timeout:777:600"]);
  const muteCase = await cases.get("g1", 1);
  assert.equal(muteCase?.action, "mute");
  assert.equal(muteCase?.durationSec, 600);
  assert.equal(muteCase?.active, true);

  const banned = await dispatcher.dispatchPrefix({
    content: "!ban <@888> raid",
    userId: "u-mod",
    guildId: "g1",
    channelId: "c1",
    rank: 1,
  });
  assert.equal(banned.kind, "ok");
  if (banned.kind === "ok") assert.match(banned.result.text, /Case #2 đã đóng/);
  const banCase = await cases.get("g1", 2);
  assert.equal(banCase?.active, false, "failed enforcement must close its case");

  const badDuration = await dispatcher.dispatchPrefix({
    content: "!mute <@777> 999x",
    userId: "u-mod",
    guildId: "g1",
    channelId: "c1",
    rank: 1,
  });
  assert.equal(badDuration.kind, "ok");
  assert.equal(await cases.countForTarget("g1", "777"), 1, "invalid duration writes no case");
});
