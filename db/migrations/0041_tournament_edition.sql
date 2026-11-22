-- Spec 6.38 (Tín 2026-11-22): EN and JP editions battle separately.
-- A tournament's edition is fixed by the FIRST entrant's deck; later
-- entrants must bring a deck of the same edition. NULL = nobody has
-- entered yet, so the edition is still open.
ALTER TABLE tcg_tournaments ADD COLUMN IF NOT EXISTS edition TEXT;
