-- Spec 6.37: card language editions. APITCG species are English ('en');
-- TCGSDK Japanese editions land as their own species rows with 'jp'.
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS language TEXT NOT NULL DEFAULT 'en';
CREATE INDEX IF NOT EXISTS game_species_language_idx ON game_species (language);
