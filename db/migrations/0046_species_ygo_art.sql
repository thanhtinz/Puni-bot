-- Spec 6.39 (hologram pass): the monster-art-only image for a
-- Yu-Gi-Oh species (YGOPRODeck cropped art), projected as the
-- monster's hologram above its field slot in the web arena.
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS ygo_art_url TEXT;
