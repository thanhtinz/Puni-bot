import assert from "node:assert/strict";
import test from "node:test";
import { normalizeFarmConfig, plotsFor } from "../src/services/farm";

test("farm config: defaults, clamps, member plots", () => {
  assert.deepEqual(normalizeFarmConfig(null), {
    enabled: true,
    defaultPlots: 6,
    memberExtraPlots: 3,
  });
  const cfg = normalizeFarmConfig({ enabled: false, defaultPlots: 999, memberExtraPlots: -2 });
  assert.equal(cfg.enabled, false);
  assert.equal(cfg.defaultPlots, 60);
  assert.equal(cfg.memberExtraPlots, 0);
  assert.equal(plotsFor(normalizeFarmConfig(null), false), 6);
  assert.equal(plotsFor(normalizeFarmConfig(null), true), 9);
});
