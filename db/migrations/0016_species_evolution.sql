-- Evolution link for TCG /card evolve (spec 6.23). Backfilled by
-- db/seeds/tcg-evolution.sql (generated from Tuxemon data).
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS evolves_to TEXT;
