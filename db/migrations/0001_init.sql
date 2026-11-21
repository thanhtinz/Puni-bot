-- Puni bot database — initial schema (spec 2.5, 5, 6.16.1).
-- Applied by bot/src/db/migrate.ts in filename order; each file runs once
-- and is recorded in schema_migrations.

CREATE TABLE IF NOT EXISTS schema_migrations (
  name        TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-guild settings: the single source of truth shared by Discord
-- commands and the dashboard (spec: two-surface config law).
CREATE TABLE IF NOT EXISTS guild_settings (
  guild_id            TEXT PRIMARY KEY,
  prefix              TEXT NOT NULL DEFAULT '!',
  shop_enabled        BOOLEAN NOT NULL DEFAULT false,
  modules             JSONB NOT NULL DEFAULT '{}'::jsonb,
  reaction_overrides  JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Global economy (spec 6.16.1): one account per Discord user across
-- every guild and white-label instance.
CREATE TABLE IF NOT EXISTS economy_accounts (
  user_id        TEXT PRIMARY KEY,
  balance        BIGINT NOT NULL DEFAULT 0 CHECK (balance >= 0),
  last_daily_day TEXT,
  daily_streak   INTEGER NOT NULL DEFAULT 0,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Append-only economy ledger for reconciliation.
CREATE TABLE IF NOT EXISTS economy_ledger (
  id            BIGSERIAL PRIMARY KEY,
  user_id       TEXT NOT NULL,
  delta         BIGINT NOT NULL,
  balance_after BIGINT NOT NULL,
  source        TEXT NOT NULL,
  note          TEXT NOT NULL DEFAULT '',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_economy_ledger_user ON economy_ledger (user_id, id);
