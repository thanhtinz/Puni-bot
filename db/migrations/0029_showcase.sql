-- Collection Showcase (spec 6.30): one row per player who owns or has
-- configured a showcase page. pins holds tcg_instances codes in display
-- order (max 12, enforced in the service layer). unlocked_themes holds
-- paid background ids beyond the free set.
CREATE TABLE IF NOT EXISTS tcg_showcases (
  user_id TEXT PRIMARY KEY,
  owned BOOLEAN NOT NULL DEFAULT FALSE,
  is_public BOOLEAN NOT NULL DEFAULT TRUE,
  layout TEXT NOT NULL DEFAULT 'grid',
  theme TEXT NOT NULL DEFAULT 'classic',
  effect TEXT NOT NULL DEFAULT 'none',
  pins TEXT[] NOT NULL DEFAULT '{}',
  unlocked_themes TEXT[] NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
