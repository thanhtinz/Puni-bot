-- Membership (spec 6.19): global per-user membership records.
-- Tier DEFINITIONS live in bot_config ('membership_tiers', owner-edited
-- in the Admin panel) — this table only records WHO holds which tier
-- and until when. An expired row is simply inactive.
CREATE TABLE IF NOT EXISTS memberships (
  user_id TEXT PRIMARY KEY,
  tier_id TEXT NOT NULL,
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  source TEXT NOT NULL DEFAULT 'manual',
  note TEXT NOT NULL DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS memberships_expires_idx ON memberships (expires_at);
