-- TCG ranked ladder + PvP duels (spec 6.26).
CREATE TABLE IF NOT EXISTS tcg_ranked_profiles (
  user_id       TEXT PRIMARY KEY,
  mmr           INTEGER NOT NULL DEFAULT 1000,
  wins          INTEGER NOT NULL DEFAULT 0,
  losses        INTEGER NOT NULL DEFAULT 0,
  season        TEXT NOT NULL DEFAULT '',
  season_wins   INTEGER NOT NULL DEFAULT 0,
  season_losses INTEGER NOT NULL DEFAULT 0,
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS tcg_duels (
  id            BIGSERIAL PRIMARY KEY,
  challenger_id TEXT NOT NULL,
  opponent_id   TEXT NOT NULL,
  wager         BIGINT NOT NULL DEFAULT 0,
  status        TEXT NOT NULL DEFAULT 'pending', -- pending | done | rejected | expired
  winner_id     TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at   TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tcg_duels_opponent
  ON tcg_duels (opponent_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tcg_duels_challenger
  ON tcg_duels (challenger_id, status, created_at DESC);
