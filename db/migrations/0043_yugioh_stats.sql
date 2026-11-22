-- Spec 6.39: Yu-Gi-Oh battles by the real rules need the cards' real
-- stats from the source (YGOPRODeck): ATK / DEF / Level / Attribute /
-- Race / card type. Filled by scripts/import-yugioh-stats.py for every
-- ygo- species whose name matches a source card.
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS ygo_atk INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS ygo_def INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS ygo_level INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS ygo_attribute TEXT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS ygo_race TEXT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS ygo_card_type TEXT;
