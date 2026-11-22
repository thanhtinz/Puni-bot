-- Spec 6.39: One Piece battles by the real rules need the cards'
-- real stats: DON cost, power, counter value, leader life and the
-- card kind (Leader / Character / Event / Stage), taken from the
-- APITCG catalog data (staging dump, no extra API calls).
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS op_cost INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS op_power INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS op_counter INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS op_life INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS op_kind TEXT;
