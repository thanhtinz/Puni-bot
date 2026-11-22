-- Dragon Ball Fusion World real stats (spec 6.39): energy cost,
-- power (leader: front / awakened back), combo power and card kind,
-- parsed from the APITCG staging dump (official card data).
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS db_cost INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS db_power INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS db_power_awake INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS db_combo INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS db_kind TEXT;
CREATE INDEX IF NOT EXISTS idx_species_db ON game_species (db_kind) WHERE db_power IS NOT NULL;
