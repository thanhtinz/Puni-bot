-- Spec 6.37: Deck Search — players can publish a complete deck for
-- others to find and adopt. author_name snapshots the publisher's
-- display name at publish time (there is no global username table).
ALTER TABLE tcg_decks ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE tcg_decks ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;
ALTER TABLE tcg_decks ADD COLUMN IF NOT EXISTS import_count INT NOT NULL DEFAULT 0;
ALTER TABLE tcg_decks ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT '';
ALTER TABLE tcg_decks ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT '';
CREATE INDEX IF NOT EXISTS tcg_decks_public_idx ON tcg_decks (published_at DESC) WHERE is_public;
