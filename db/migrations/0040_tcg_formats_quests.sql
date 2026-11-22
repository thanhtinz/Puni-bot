-- 0040: TCG battle formats (Draft Arena / Sealed / Daily Challenge)
-- and daily TCG quests (spec 6.38). Format runs keep their whole
-- state in one JSONB document so the bot and the dashboard drive the
-- exact same run; daily-challenge rewards ride the existing
-- tcg_claims table (kind 'dailychal', period = UTC day), as do the
-- free daily format entries (kind 'formatfree:draft' / ':sealed').
CREATE TABLE IF NOT EXISTS tcg_format_runs (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  format TEXT NOT NULL, -- draft | sealed
  state JSONB NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'building', -- building | fighting | done
  paid BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '24 hours')
);
CREATE INDEX IF NOT EXISTS tcg_format_runs_user_idx
  ON tcg_format_runs (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS tcg_quest_progress (
  user_id TEXT NOT NULL,
  day TEXT NOT NULL, -- YYYY-MM-DD (UTC)
  quest_id TEXT NOT NULL,
  progress INT NOT NULL DEFAULT 0,
  claimed BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, day, quest_id)
);
