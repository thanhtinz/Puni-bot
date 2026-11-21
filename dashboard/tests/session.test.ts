import { test } from "node:test";
import assert from "node:assert/strict";

process.env.SESSION_SECRET = "test-secret-for-session-signing-0123456789";

import {
  createSessionToken,
  verifySessionToken,
  createAdminToken,
  verifyAdminToken,
  canManageGuild,
  manageableGuilds,
} from "../src/lib/session";

const NOW = 1_800_000_000;

test("session token round-trips and expires", () => {
  const token = createSessionToken({
    userId: "123",
    username: "tin",
    avatar: null,
    guilds: [{ id: "g1", name: "Server", permissions: "32" }],
    nowSec: NOW,
  });
  const s = verifySessionToken(token, NOW + 60);
  assert.equal(s?.userId, "123");
  assert.equal(s?.guilds[0].id, "g1");
  // expired after TTL (7 days)
  assert.equal(verifySessionToken(token, NOW + 8 * 24 * 3600), null);
});

test("tampered session token is rejected", () => {
  const token = createSessionToken({
    userId: "123",
    username: "tin",
    avatar: null,
    guilds: [],
    nowSec: NOW,
  });
  const [body, sig] = token.split(".");
  const forged = Buffer.from(
    JSON.stringify({ userId: "999", username: "x", avatar: null, guilds: [], exp: NOW + 1000 }),
    "utf8",
  ).toString("base64url");
  assert.equal(verifySessionToken(`${forged}.${sig}`, NOW), null);
  assert.equal(verifySessionToken(`${body}.invalidsig`, NOW), null);
  assert.equal(verifySessionToken("garbage", NOW), null);
  assert.equal(verifySessionToken(null, NOW), null);
});

test("admin token is bound to the owner id", () => {
  const token = createAdminToken("847746890808164383", NOW);
  assert.equal(verifyAdminToken(token, "847746890808164383", NOW + 60), true);
  assert.equal(verifyAdminToken(token, "111", NOW + 60), false);
  assert.equal(verifyAdminToken(token, "847746890808164383", NOW + 13 * 3600), false);
});

test("guild manage permission: ADMINISTRATOR or MANAGE_GUILD bits", () => {
  const mk = (permissions: string) => ({
    userId: "1",
    username: "u",
    avatar: null,
    exp: NOW + 100,
    guilds: [{ id: "g", name: "S", permissions }],
  });
  assert.equal(canManageGuild(mk("8"), "g"), true); // ADMINISTRATOR
  assert.equal(canManageGuild(mk("32"), "g"), true); // MANAGE_GUILD
  assert.equal(canManageGuild(mk("40"), "g"), true); // both
  assert.equal(canManageGuild(mk("1024"), "g"), false); // unrelated bit
  assert.equal(canManageGuild(mk("8"), "other"), false); // not a member entry
  assert.equal(manageableGuilds(mk("32")).length, 1);
  assert.equal(manageableGuilds(mk("0")).length, 0);
});
