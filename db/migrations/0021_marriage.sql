-- Marriage system (spec 6.16.5, TCG-era gift per 6.25): global by
-- Discord ID. A pair is stored once with user_a < user_b.
CREATE TABLE IF NOT EXISTS marriages (
  user_a     TEXT NOT NULL,
  user_b     TEXT NOT NULL,
  ring_tier  INTEGER NOT NULL DEFAULT 1,
  married_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_a, user_b),
  CHECK (user_a < user_b)
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marriages_a ON marriages (user_a);
CREATE UNIQUE INDEX IF NOT EXISTS idx_marriages_b ON marriages (user_b);

CREATE TABLE IF NOT EXISTS marriage_proposals (
  id         BIGSERIAL PRIMARY KEY,
  from_user  TEXT NOT NULL,
  to_user    TEXT NOT NULL,
  ring_tier  INTEGER NOT NULL,
  status     TEXT NOT NULL DEFAULT 'pending', -- pending | accepted | rejected | expired
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_proposals_to ON marriage_proposals (to_user, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_from ON marriage_proposals (from_user, status, created_at DESC);

-- Rings owned but not yet used in a proposal.
CREATE TABLE IF NOT EXISTS marriage_rings (
  user_id TEXT NOT NULL,
  tier    INTEGER NOT NULL,
  qty     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, tier)
);

-- Couple daily gift tracking: one row per spouse claim per day; when
-- both spouses claimed on the same day the gift is granted once.
CREATE TABLE IF NOT EXISTS couple_daily (
  user_id TEXT NOT NULL,
  day     TEXT NOT NULL,
  gifted  BOOLEAN NOT NULL DEFAULT false,
  PRIMARY KEY (user_id, day)
);
