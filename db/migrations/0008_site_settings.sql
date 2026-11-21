-- Site-wide settings for the public website (owner ruling 2026-11-21 18:46):
-- key/value pairs edited from the Admin panel, e.g. support_url shown in
-- the public menu. Kept in the bot's own database like everything else.
CREATE TABLE IF NOT EXISTS site_settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
