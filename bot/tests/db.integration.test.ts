/**
 * PostgreSQL integration tests — run ONLY when PUNI_TEST_DATABASE_URL is
 * set (a throwaway database; the suite truncates its tables).
 *   PUNI_TEST_DATABASE_URL=postgres://postgres@127.0.0.1:5434/puni_test npm test
 */
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import * as path from "node:path";
import { Pool } from "pg";
import { runMigrations } from "../src/db/migrate";
import { PgEconomyStore } from "../src/db/pg-economy-store";
import { PgGuildSettings } from "../src/db/pg-guild-settings";
import { EconomyService, InsufficientFundsError } from "../src/services/economy";

const url = process.env.PUNI_TEST_DATABASE_URL;
const skip = !url;

let pool: Pool;

before(async () => {
  if (skip) return;
  pool = new Pool({ connectionString: url });
  await runMigrations(pool, path.resolve(__dirname, "../../db/migrations"));
  await pool.query(
    "TRUNCATE economy_ledger, economy_accounts, guild_settings RESTART IDENTITY",
  );
});

after(async () => {
  if (skip) return;
  await pool.end();
});

test("migrations are idempotent", { skip }, async () => {
  const applied = await runMigrations(pool, path.resolve(__dirname, "../../db/migrations"));
  assert.deepEqual(applied, []);
});

test("pg guild settings: defaults, round-trip, visible to a fresh provider", { skip }, async () => {
  const a = new PgGuildSettings(pool);
  const dflt = await a.get("g-new");
  assert.equal(dflt.prefix, "!");
  assert.equal(dflt.shopEnabled, false);
  await a.set("g-new", {
    prefix: "?",
    shopEnabled: true,
    reactionOverrides: { kiss: { enabled: false } },
  });
  const b = new PgGuildSettings(pool);
  const read = await b.get("g-new");
  assert.equal(read.prefix, "?");
  assert.equal(read.shopEnabled, true);
  assert.equal(read.reactionOverrides.kiss?.enabled, false);
});

test("pg economy: same semantics as the in-memory store", { skip }, async () => {
  const eco = new EconomyService(new PgEconomyStore(pool));
  await eco.credit("u1", 100, "test");
  assert.equal(await eco.getBalance("u1"), 100);
  await assert.rejects(() => eco.debit("u1", 150, "test"), InsufficientFundsError);
  assert.equal(await eco.getBalance("u1"), 100);
  await eco.transfer("u1", "u2", 40);
  assert.equal(await eco.getBalance("u1"), 60);
  assert.equal(await eco.getBalance("u2"), 40);
  const claim = await eco.claimDaily("u1", new Date("2026-02-01T10:00:00Z"));
  assert.deepEqual(claim, { amount: 100, streak: 1 });
  const again = await eco.claimDaily("u1", new Date("2026-02-01T20:00:00Z"));
  assert.equal(again, null);
});

test("pg economy race: 20 parallel debits of 10 against a balance of 100 — exactly 10 land", { skip }, async () => {
  const eco = new EconomyService(new PgEconomyStore(pool));
  await eco.credit("racer", 100, "test");
  const results = await Promise.allSettled(
    Array.from({ length: 20 }, () => eco.debit("racer", 10, "race")),
  );
  const ok = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter(
    (r) => r.status === "rejected" && r.reason instanceof InsufficientFundsError,
  ).length;
  assert.equal(ok, 10, "exactly 10 debits may succeed");
  assert.equal(failed, 10, "the other 10 must fail closed");
  assert.equal(await eco.getBalance("racer"), 0, "balance ends at exactly 0, never negative");
  const ledger = await eco.ledgerFor("racer");
  assert.equal(ledger.filter((e) => e.source === "race").length, 10);
  assert.ok(ledger.every((e) => e.balanceAfter >= 0), "no ledger line ever shows a negative balance");
});
