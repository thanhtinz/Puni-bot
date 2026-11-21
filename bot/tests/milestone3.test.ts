import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import RedisMock from "ioredis-mock";
import { rankFromMember } from "../src/permissions";
import { RedisCooldownStore } from "../src/services/redis-cooldown";

test("permissions: Discord flags map to dispatcher ranks", () => {
  assert.equal(rankFromMember({ isGuildOwner: true, permissions: 0n }), 2);
  assert.equal(rankFromMember({ isGuildOwner: false, permissions: PermissionFlagsBits.Administrator }), 2);
  assert.equal(rankFromMember({ isGuildOwner: false, permissions: PermissionFlagsBits.ManageGuild }), 2);
  assert.equal(rankFromMember({ isGuildOwner: false, permissions: PermissionFlagsBits.BanMembers }), 1);
  assert.equal(rankFromMember({ isGuildOwner: false, permissions: PermissionFlagsBits.ManageMessages }), 1);
  assert.equal(rankFromMember({ isGuildOwner: false, permissions: PermissionFlagsBits.SendMessages }), 0);
});

interface CapturedCall {
  url: string;
  init: RequestInit;
}

function stubFetch(response: { status?: number; body?: unknown }) {
  const calls: CapturedCall[] = [];
  const fetchImpl = (async (url: unknown, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    return new Response(JSON.stringify(response.body ?? {}), {
      status: response.status ?? 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as unknown as typeof fetch;
  return { calls, fetchImpl };
}




test("redis cooldown store: first claim wins, second is throttled with time left (ioredis-mock)", async () => {
  const redis = new RedisMock();
  const store = new RedisCooldownStore(redis as never);
  const first = await store.tryAcquire("hug:u1", 30);
  assert.deepEqual(first, { ok: true });
  const second = await store.tryAcquire("hug:u1", 30);
  assert.equal(second.ok, false);
  if (!second.ok) assert.ok(second.secondsLeft > 0 && second.secondsLeft <= 30);
  const other = await store.tryAcquire("hug:u2", 30);
  assert.deepEqual(other, { ok: true }, "cooldowns are per user");
  redis.disconnect();
});
