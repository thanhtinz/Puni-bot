-- Werewolf role-card art (owner-supplied set, 2026-11-22): an outbox
-- item may carry an artwork filename (assets/werewolf/<file>) that the
-- shard tick attaches to the delivered message — used by the secret
-- role DM at game start so every player gets their role card image.
ALTER TABLE werewolf_outbox ADD COLUMN IF NOT EXISTS art TEXT;
