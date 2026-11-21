-- Global bot configuration owned by the bot owner (Admin panel):
-- key/value JSONB. Known keys: 'economy' (EconomyConfig) and
-- 'ai_enabled' (boolean master switch for AI chat). The bot reads
-- these with a short cache so admin edits take effect live.
CREATE TABLE IF NOT EXISTS bot_config (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
