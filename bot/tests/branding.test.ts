import { test } from "node:test";
import assert from "node:assert/strict";
import {
  normalizeBranding,
  brandingFingerprint,
  brandingIsDefault,
  applyBranding,
} from "../src/branding";

test("normalizeBranding clamps and validates", () => {
  assert.deepEqual(normalizeBranding(null), { nickname: "", avatarDataUri: "" });
  assert.equal(normalizeBranding({ nickname: "  Puni BNT  " }).nickname, "Puni BNT");
  assert.equal(normalizeBranding({ nickname: "x".repeat(40) }).nickname.length, 32);
  assert.equal(normalizeBranding({ avatarDataUri: "https://evil.example/a.png" }).avatarDataUri, "");
  const ok = "data:image/png;base64,AAAA";
  assert.equal(normalizeBranding({ avatarDataUri: ok }).avatarDataUri, ok);
  assert.equal(normalizeBranding({ avatarDataUri: "data:image/png;base64," + "A".repeat(300_000) }).avatarDataUri, "");
});

test("fingerprint changes with config and is stable", () => {
  const a = normalizeBranding({ nickname: "A" });
  const b = normalizeBranding({ nickname: "B" });
  assert.notEqual(brandingFingerprint(a), brandingFingerprint(b));
  assert.equal(brandingFingerprint(a), brandingFingerprint(normalizeBranding({ nickname: "A" })));
  assert.ok(brandingIsDefault(normalizeBranding(null)));
  assert.ok(!brandingIsDefault(a));
});

test("applyBranding patches current member with nulls for defaults", async () => {
  const calls: { route: string; body: unknown }[] = [];
  const rest = {
    patch: async (route: string, options: { body: unknown }) => {
      calls.push({ route, body: options.body });
    },
  };
  await applyBranding(rest, "123", { nickname: "Puni BNT", avatarDataUri: "data:image/png;base64,AA" });
  assert.equal(calls[0].route, "/guilds/123/members/@me");
  assert.deepEqual(calls[0].body, { nick: "Puni BNT", avatar: "data:image/png;base64,AA" });
  await applyBranding(rest, "123", { nickname: "", avatarDataUri: "" });
  assert.deepEqual(calls[1].body, { nick: null, avatar: null });
});
