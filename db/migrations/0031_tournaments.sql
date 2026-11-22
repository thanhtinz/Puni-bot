-- Tournament system (spec 6.32): single-elimination brackets of 8 or
-- 16 players. Entry fees are charged at join (economy_ledger source
-- 'tournament'); the deck is SNAPSHOTTED at join so later trades do
-- not change a running bracket. Matches are deterministic battles
-- (seed = match id) once BOTH players check in; a match left unplayed
-- 10 minutes after both players are known is settled as a walkover.
CREATE TABLE IF NOT EXISTS tcg_tournaments (
  id BIGSERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  size INT NOT NULL,
  entry_fee NUMERIC(14,4) NOT NULL,
  rake_percent NUMERIC(5,2) NOT NULL DEFAULT 10,
  prize_first NUMERIC(5,2) NOT NULL DEFAULT 50,
  prize_second NUMERIC(5,2) NOT NULL DEFAULT 30,
  prize_semis NUMERIC(5,2) NOT NULL DEFAULT 20,
  status TEXT NOT NULL DEFAULT 'open', -- open | running | done | cancelled
  created_by TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  champion_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_tcg_tournaments_status ON tcg_tournaments (status, id DESC);

CREATE TABLE IF NOT EXISTS tcg_tournament_entries (
  tournament_id BIGINT NOT NULL REFERENCES tcg_tournaments (id),
  user_id TEXT NOT NULL,
  seed INT,
  deck_codes TEXT[] NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS tcg_tournament_matches (
  id BIGSERIAL PRIMARY KEY,
  tournament_id BIGINT NOT NULL REFERENCES tcg_tournaments (id),
  round INT NOT NULL,
  slot INT NOT NULL,
  p1_id TEXT,
  p2_id TEXT,
  p1_in BOOLEAN NOT NULL DEFAULT FALSE,
  p2_in BOOLEAN NOT NULL DEFAULT FALSE,
  ready_at TIMESTAMPTZ,
  winner_id TEXT,
  result TEXT, -- battle | walkover | double-walkover
  log JSONB,
  played_at TIMESTAMPTZ,
  UNIQUE (tournament_id, round, slot)
);
CREATE INDEX IF NOT EXISTS idx_tcg_tournament_matches_due
  ON tcg_tournament_matches (tournament_id, round, slot);
