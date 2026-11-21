import { test } from "node:test";
import assert from "node:assert/strict";
import { Dispatcher } from "../src/dispatcher";
import { InMemoryGuildSettings } from "../src/guild-settings";
import { buildBot } from "../src/registry";
import { formatMoneyPair } from "../src/services/gems";

test("money display law: balance line always shows Coins AND Gems together, dot separators", async () => {
  const settings = new InMemoryGuildSettings();
  const { registry, economy, gems } = buildBot({ settings });
  await economy.credit("u1", 2138, "test seed");
  await gems.credit("u1", 150);
  const dispatcher = new Dispatcher(registry, settings, async () => 0, "owner-1");

  const out = await dispatcher.dispatchPrefix({
    content: "!balance",
    userId: "u1",
    guildId: "g1",
    channelId: "c1",
    rank: 0,
  });
  assert.equal(out.kind, "ok");
  if (out.kind === "ok") {
    assert.match(out.result.text, /bạn hiện có/);
    assert.match(out.result.text, /\*\*2\.138\*\* Coins/);
    assert.match(out.result.text, /\*\*150\*\* Gems/);
  }
  assert.equal(formatMoneyPair(1000000, 0, "Coins"), "**1.000.000** Coins · **0** Gems");
});

test("gems wallet: credit/debit semantics, insufficient debit is a no-op", async () => {
  const { gems } = buildBot({ settings: new InMemoryGuildSettings() });
  assert.equal(await gems.getBalance("u9"), 0);
  assert.equal(await gems.credit("u9", 40), 40);
  assert.equal(await gems.debit("u9", 15), true);
  assert.equal(await gems.getBalance("u9"), 25);
  assert.equal(await gems.debit("u9", 100), false);
  assert.equal(await gems.getBalance("u9"), 25);
});
