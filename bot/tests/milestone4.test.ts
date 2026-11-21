import { test } from "node:test";
import assert from "node:assert/strict";
import { renderTemplate, normalizeCommunityConfig } from "../src/community-config";
import { CommunityEvents } from "../src/services/community";
import { InMemoryGuildSettings } from "../src/guild-settings";
import { InMemoryModCaseStore } from "../src/services/mod-cases";
import { Dispatcher } from "../src/dispatcher";
import { buildBot } from "../src/registry";

test("template rendering fills every placeholder", () => {
  const out = renderTemplate("Chào {user} ({username}) đến {server} — #{count}", {
    user: "<@1>",
    username: "tin",
    server: "BNT",
    count: 42,
  });
  assert.equal(out, "Chào <@1> (tin) đến BNT — #42");
});

test("community config normalization keeps defaults for junk input", () => {
  const cfg = normalizeCommunityConfig({ welcome: { enabled: true, channelId: "c9" } });
  assert.equal(cfg.welcome.enabled, true);
  assert.equal(cfg.welcome.channelId, "c9");
  assert.ok(cfg.welcome.message.includes("{user}"), "default template retained");
  assert.equal(cfg.goodbye.enabled, false);
  assert.equal(normalizeCommunityConfig("garbage").boost.enabled, false);
});

test("community events: sends only when enabled with a channel", async () => {
  const settings = new InMemoryGuildSettings();
  const sent: { channelId: string; text: string }[] = [];
  const events = new CommunityEvents(settings, {
    send: async (channelId, text) => {
      sent.push({ channelId, text });
    },
  });
  const evt = { guildId: "g1", userId: "u1", username: "tin", guildName: "BNT", memberCount: 7 };
  assert.equal(await events.onMemberJoin(evt), false, "disabled by default: nothing sent");
  const s = await settings.get("g1");
  await settings.set("g1", {
    community: { ...s.community, welcome: { enabled: true, channelId: "c1", message: "Hi {user} #{count}" } },
  });
  assert.equal(await events.onMemberJoin(evt), true);
  assert.deepEqual(sent, [{ channelId: "c1", text: "Hi <@u1> #7" }]);
  assert.equal(await events.onMemberLeave(evt), false, "goodbye still disabled");
});

test("mod cases: numbering is per-guild and sequential; edit + count work", async () => {
  const store = new InMemoryModCaseStore();
  const a1 = await store.create({ guildId: "gA", targetId: "u1", moderatorId: "m1", action: "warn", reason: "spam" });
  const a2 = await store.create({ guildId: "gA", targetId: "u1", moderatorId: "m1", action: "warn" });
  const b1 = await store.create({ guildId: "gB", targetId: "u1", moderatorId: "m1", action: "ban" });
  assert.equal(a1.caseNo, 1);
  assert.equal(a2.caseNo, 2);
  assert.equal(b1.caseNo, 1, "another guild starts at #1 independently");
  const edited = await store.update("gA", 1, { reason: "spam link" });
  assert.equal(edited?.reason, "spam link");
  assert.equal(await store.countForTarget("gA", "u1", "warn"), 2);
  assert.equal(await store.countForTarget("gA", "u1"), 2);
  const list = await store.listForTarget("gA", "u1");
  assert.deepEqual(list.map((c) => c.caseNo), [2, 1], "newest first");
});

test("warn command through the dispatcher: mod creates a case, member is forbidden", async () => {
  const settings = new InMemoryGuildSettings();
  const { registry, cases } = buildBot({ settings });
  const dispatcher = new Dispatcher(registry, settings, async () => 0, "owner-1");
  const member = await dispatcher.dispatchPrefix({
    content: "!warn <@555> spam",
    userId: "u-member",
    guildId: "g1",
    channelId: "c1",
    rank: 0,
  });
  assert.equal(member.kind, "forbidden", "rank 0 cannot warn");
  const mod = await dispatcher.dispatchPrefix({
    content: "!warn <@555> spam link",
    userId: "u-mod",
    guildId: "g1",
    channelId: "c1",
    rank: 1,
  });
  assert.equal(mod.kind, "ok");
  if (mod.kind === "ok") assert.match(mod.result.text, /Case #1/);
  const stored = await cases.get("g1", 1);
  assert.equal(stored?.targetId, "555");
  assert.equal(stored?.reason, "spam link");
  const view = await dispatcher.dispatchPrefix({
    content: "!case 1",
    userId: "u-mod",
    guildId: "g1",
    channelId: "c1",
    rank: 1,
  });
  assert.equal(view.kind, "ok");
  if (view.kind === "ok") assert.match(view.result.text, /spam link/);
});
