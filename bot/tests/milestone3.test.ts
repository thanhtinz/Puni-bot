import { test } from "node:test";
import assert from "node:assert/strict";
import { PermissionFlagsBits } from "discord.js";
import RedisMock from "ioredis-mock";
import { rankFromMember } from "../src/permissions";
import { ShopApiClient, ShopApiError } from "../src/services/shop-api";
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

test("shop api client: bot key header, guildId on sales actions, idempotency forwarded", async () => {
  const { calls, fetchImpl } = stubFetch({ body: { code: "DH1" } });
  const api = new ShopApiClient({
    baseUrl: "https://shop.example/api/bot/v1/",
    botKey: "secret-key",
    fetchImpl,
  });
  await api.createOrder({
    guildId: "g1",
    discordId: "u1",
    productId: "p1",
    paymentMethod: "wallet",
    idempotencyKey: "order-attempt-1",
  });
  assert.equal(calls.length, 1);
  const { url, init } = calls[0];
  assert.equal(url, "https://shop.example/api/bot/v1/orders");
  const headers = init.headers as Record<string, string>;
  assert.equal(headers["X-Bot-Key"], "secret-key");
  assert.equal(headers["Idempotency-Key"], "order-attempt-1");
  const body = JSON.parse(String(init.body)) as Record<string, unknown>;
  assert.equal(body.guildId, "g1", "sales actions must carry guildId (spec 6.11)");
  assert.equal("idempotencyKey" in body, false, "idempotency key travels in the header, not the body");
});

test("shop api client: read calls put discordId in the query; Shop errors are typed", async () => {
  const ok = stubFetch({ body: { balance: 5 } });
  const api = new ShopApiClient({ baseUrl: "https://shop.example/api/bot/v1", botKey: "k", fetchImpl: ok.fetchImpl });
  await api.getWallet("u9");
  assert.ok(ok.calls[0].url.includes("/wallet?discordId=u9"));

  const bad = stubFetch({ status: 403, body: { error: "guild not declared for sales" } });
  const api2 = new ShopApiClient({ baseUrl: "https://shop.example/api/bot/v1", botKey: "k", fetchImpl: bad.fetchImpl });
  await assert.rejects(
    () => api2.createOrder({ guildId: "gx", discordId: "u1", productId: "p", paymentMethod: "wallet" }),
    (err: unknown) => {
      assert.ok(err instanceof ShopApiError);
      assert.equal(err.status, 403);
      assert.match(err.message, /guild not declared/);
      return true;
    },
  );
});

test("shop api client: missing bot key is a hard config error", () => {
  assert.throws(() => new ShopApiClient({ baseUrl: "https://x", botKey: "" }), /bot key is required/);
});

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
