-- Logging (spec 6.6: 5 event groups, each toggleable) and automod
-- (spec 6.7) configuration, one JSONB document each on guild_settings.
ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS logging JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS automod JSONB NOT NULL DEFAULT '{}'::jsonb;
