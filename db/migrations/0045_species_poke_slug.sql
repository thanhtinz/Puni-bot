-- Spec 6.39 (hologram pass): the Pokémon Showdown animated-sprite
-- id for this species (e.g. "charizard", "ampharos-mega",
-- "vulpix-alola"), used by the web arena to project an animated
-- hologram of the Active Pokémon while it attacks. NULL when the
-- card's Pokémon could not be identified.
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS poke_slug TEXT;
