-- AI chat per-guild switch (spec: AI chat — @Puni mention replies).
-- JSONB document, same pattern as community/logging/automod.
ALTER TABLE guild_settings
  ADD COLUMN IF NOT EXISTS ai_chat JSONB NOT NULL DEFAULT '{"enabled":true}';
