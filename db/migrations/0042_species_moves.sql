-- Spec 6.39: per-game battle engines need the cards' REAL moves.
-- Filled from the APITCG staging data (Pokémon first): each move is
-- {name, cost (energy letters, e.g. "2G", "CCC"), damage, effect}.
-- poke_type is the card's own type letter (G/W/R/L/P/F/D/M/Y/N/C).
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS moves JSONB;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS hp_real INT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS poke_type TEXT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS weakness TEXT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS resistance TEXT;
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS retreat INT;
