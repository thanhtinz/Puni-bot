-- Digimon Card Game real stats (spec 6.39i), parsed from the APITCG
-- staging dump: DigimonPowerDP, PlayCost, LevelLv and the primary
-- digivolution requirement (Digivolve1*). Species without a DP are
-- not Digimon and stay out of the Digimon engine pool.
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS dig_dp INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS dig_cost INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS dig_level INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS dig_evo_cost INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS dig_evo_level INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS dig_evo_color TEXT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS dig_color TEXT;
CREATE INDEX IF NOT EXISTS game_species_dig_dp_idx ON game_species (dig_dp) WHERE dig_dp IS NOT NULL;
