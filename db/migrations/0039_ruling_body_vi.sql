-- Spec 6.37 addendum (owner order 2026-11-22): on-demand Vietnamese
-- translation of synced rulings. body stays the English original;
-- body_vi is filled lazily by the web app the first time a card's
-- rulings are viewed (DeepL), then served from this cache forever.
-- Only rows carrying a reserved sync source are ever translated —
-- hand-entered rulings are already Vietnamese and keep body_vi NULL.
ALTER TABLE tcg_rulings ADD COLUMN IF NOT EXISTS body_vi TEXT;
