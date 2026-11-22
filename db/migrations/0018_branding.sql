-- White label (spec 6.25): per-guild branding the bot applies to
-- itself inside that guild (nickname + guild member avatar).
-- branding_applied holds the fingerprint of the last applied config
-- so the bot only calls the Discord API when something changed.
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS branding JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE guild_settings ADD COLUMN IF NOT EXISTS branding_applied TEXT NOT NULL DEFAULT '';
