import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_AUTOMOD_CONFIG,
  DEFAULT_COMMUNITY_CONFIG,
  DEFAULT_LOG_CONFIG,
  normalizeAutomodConfig,
  normalizeCommunityConfig,
  normalizeLogConfig,
} from "../src/lib/guild-config";

test("normalize falls back to defaults for missing/garbage input", () => {
  assert.deepEqual(normalizeCommunityConfig(undefined), DEFAULT_COMMUNITY_CONFIG);
  assert.deepEqual(normalizeCommunityConfig("junk"), DEFAULT_COMMUNITY_CONFIG);
  assert.deepEqual(normalizeLogConfig(null), DEFAULT_LOG_CONFIG);
  assert.deepEqual(normalizeAutomodConfig(42), DEFAULT_AUTOMOD_CONFIG);
});

test("normalize merges stored values over defaults (bot-written JSON)", () => {
  const c = normalizeCommunityConfig({
    welcome: { enabled: true, channelId: "123456789", message: "Xin chào {user}" },
  });
  assert.equal(c.welcome.enabled, true);
  assert.equal(c.welcome.channelId, "123456789");
  assert.equal(c.welcome.message, "Xin chào {user}");
  assert.equal(c.goodbye.enabled, false); // untouched section keeps default

  const l = normalizeLogConfig({ enabled: true, channelId: "999", groups: { messages: false } });
  assert.equal(l.enabled, true);
  assert.equal(l.groups.messages, false);
  assert.equal(l.groups.members, true); // other groups default on

  const a = normalizeAutomodConfig({ enabled: true, blockedWords: ["x"], capsRatio: 2 });
  assert.equal(a.enabled, true);
  assert.deepEqual(a.blockedWords, ["x"]);
  assert.equal(a.capsRatio, 0); // out-of-range ratio rejected to default
});
