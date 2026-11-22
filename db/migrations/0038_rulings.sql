-- Spec 6.37: Rulings — official card rulings curated by the owner in
-- the Admin panel (TCGSDK exposes no rulings data, verified 2026-11-22,
-- so rulings are Puni's own content). A ruling targets exactly one
-- scope: a species, a set, or a whole game family (prefix).
CREATE TABLE IF NOT EXISTS tcg_rulings (
  id BIGSERIAL PRIMARY KEY,
  species_id TEXT REFERENCES game_species (id) ON DELETE CASCADE,
  set_id TEXT REFERENCES game_sets (id) ON DELETE CASCADE,
  game_prefix TEXT NOT NULL DEFAULT '',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tcg_rulings_species_idx ON tcg_rulings (species_id);
CREATE INDEX IF NOT EXISTS tcg_rulings_set_idx ON tcg_rulings (set_id);
CREATE INDEX IF NOT EXISTS tcg_rulings_game_idx ON tcg_rulings (game_prefix);
