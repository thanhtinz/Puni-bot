-- Community configuration (welcome/goodbye/boost, spec 6.5) rides on
-- guild_settings as one JSONB document, edited by both Discord commands
-- and the dashboard (two-surface law).
ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS community JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Moderation CASE system (spec 6.7): every mod action creates a case with
-- a per-guild sequential number. The counter row is locked inside the
-- same transaction that inserts the case, so numbers never collide or
-- repeat within a guild.
CREATE TABLE IF NOT EXISTS mod_case_counters (
  guild_id  TEXT PRIMARY KEY,
  next_no   INTEGER NOT NULL DEFAULT 1
);

CREATE TABLE IF NOT EXISTS mod_cases (
  id            BIGSERIAL PRIMARY KEY,
  guild_id      TEXT NOT NULL,
  case_no       INTEGER NOT NULL,
  target_id     TEXT NOT NULL,
  moderator_id  TEXT NOT NULL,
  action        TEXT NOT NULL, -- warn | mute | kick | ban | unmute | unban | note
  reason        TEXT NOT NULL DEFAULT '',
  duration_sec  INTEGER,
  active        BOOLEAN NOT NULL DEFAULT true,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (guild_id, case_no)
);
CREATE INDEX IF NOT EXISTS idx_mod_cases_target ON mod_cases (guild_id, target_id, case_no DESC);
