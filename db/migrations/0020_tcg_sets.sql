-- Card SETS (spec 6.27): Tuxemon is only the first set; more sets
-- will be developed. Every species/card belongs to exactly one set.
CREATE TABLE IF NOT EXISTS game_sets (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  sort        INTEGER NOT NULL DEFAULT 0,
  enabled     BOOLEAN NOT NULL DEFAULT true,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO game_sets (id, name, description, sort)
VALUES ('tuxemon', 'Bộ Tuxemon', 'Bộ thẻ đầu tiên của Puni — 411 loài từ Tuxemon (CC-BY-SA).', 1)
ON CONFLICT (id) DO NOTHING;

ALTER TABLE game_species ADD COLUMN IF NOT EXISTS set_id TEXT NOT NULL DEFAULT 'tuxemon';
CREATE INDEX IF NOT EXISTS idx_game_species_set ON game_species (set_id);
