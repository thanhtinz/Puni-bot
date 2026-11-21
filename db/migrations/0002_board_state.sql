-- Board state lives in the BOT database (Tín chốt 2026-11-21 15:53):
-- the bot remembers which Discord message each board is, so a sync edits
-- that message in place instead of posting a new one. Shop keeps no copy;
-- the internal Shop API has no board-config endpoint for msgId/hash.
CREATE TABLE IF NOT EXISTS board_state (
  guild_id    TEXT NOT NULL,
  board_key   TEXT NOT NULL,
  channel_id  TEXT NOT NULL,
  message_id  TEXT NOT NULL,
  content_hash TEXT NOT NULL,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, board_key)
);
