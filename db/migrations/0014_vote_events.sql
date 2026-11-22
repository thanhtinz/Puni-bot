-- Vote events from top.gg (spec 6.22). One row per ACCEPTED vote;
-- the 12-hour dedupe window is enforced against the latest row.
CREATE TABLE IF NOT EXISTS vote_events (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'topgg',
  reward BIGINT NOT NULL DEFAULT 0,
  is_weekend BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS vote_events_user_idx ON vote_events (user_id, created_at DESC);
