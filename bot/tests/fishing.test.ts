/** Fishing (spec 6.20): config normalization, rarity roll, price range,
 *  cooldown and the daily cap. */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FISHING_CONFIG,
  FishingService,
  normalizeFishingConfig,
  rollFishPrice,
  rollFishRarity,
} from "../src/services/fishing";

test("normalize: defaults when unset, ranges repaired, all-zero weights fall back", () => {
  assert.deepEqual(normalizeFishingConfig(null), DEFAULT_FISHING_CONFIG);
  const c = normalizeFishingConfig({
    cooldownSec: 30,
    priceMin: { common: 100 },
    priceMax: { common: 50 },
    weights: { common: 0, uncommon: 0, rare: 0, epic: 0, legendary: 0 },
  });
  assert.equal(c.cooldownSec, 30);
  assert.equal(c.priceMin.common, 100);
  assert.equal(c.priceMax.common, 100); // max raised to min
  assert.equal(c.weights.common, 60); // fallback weights
});

test("roll: weight boundaries pick the right rarity", () => {
  const cfg = normalizeFishingConfig(null); // 60/25/10/4/1
  assert.equal(rollFishRarity(cfg, () => 0), "common");
  assert.equal(rollFishRarity(cfg, () => 0.5999), "common");
  assert.equal(rollFishRarity(cfg, () => 0.6), "uncommon");
  assert.equal(rollFishRarity(cfg, () => 0.85), "rare");
  assert.equal(rollFishRarity(cfg, () => 0.95), "epic");
  assert.equal(rollFishRarity(cfg, () => 0.995), "legendary");
});

test("price: stays inside the rarity range", () => {
  const cfg = normalizeFishingConfig(null);
  assert.equal(rollFishPrice(cfg, "common", () => 0), 5);
  assert.equal(rollFishPrice(cfg, "common", () => 0.99999), 15);
  assert.equal(rollFishPrice(cfg, "legendary", () => 0), 400);
});

test("service: cooldown blocks recast, cap trims the credit, disabled refuses", async () => {
  let now = 1_000_000;
  const credited: number[] = [];
  const svc = new FishingService({
    configSource: async () => normalizeFishingConfig({ dailyCap: 10, cooldownSec: 60 }),
    earnedToday: async () => 0,
    credit: async (_u, amount) => {
      credited.push(amount);
    },
    rng: () => 0, // always common, price = min 5
    now: () => now,
  });
  const first = await svc.cast("u1");
  assert.equal(first.kind, "caught");
  if (first.kind === "caught") assert.equal(first.credited, 5);
  const second = await svc.cast("u1");
  assert.equal(second.kind, "cooldown");
  now += 61_000;
  const third = await svc.cast("u1");
  assert.equal(third.kind, "caught");
  if (third.kind === "caught") {
    // earnedToday is stubbed 0, but the cap applies against price only via room:
    // stub returns 0 so room = 10, price 5 → full credit.
    assert.equal(third.credited, 5);
  }
  assert.deepEqual(credited, [5, 5]);

  const cappedSvc = new FishingService({
    configSource: async () => normalizeFishingConfig({ dailyCap: 100 }),
    earnedToday: async () => 100,
    credit: async () => {
      throw new Error("must not credit past the cap");
    },
    rng: () => 0,
    now: () => Date.now(),
  });
  const capped = await cappedSvc.cast("u2");
  assert.equal(capped.kind, "caught");
  if (capped.kind === "caught") {
    assert.equal(capped.credited, 0);
    assert.equal(capped.capped, true);
  }

  const offSvc = new FishingService({
    configSource: async () => normalizeFishingConfig({ enabled: false }),
    earnedToday: async () => 0,
    credit: async () => {},
  });
  assert.equal((await offSvc.cast("u3")).kind, "disabled");
});
