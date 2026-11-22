-- Channel games (spec 6.16): counting (nối số / đếm số) and word
-- chain (nối chữ) — one game per channel, state in JSONB.
CREATE TABLE IF NOT EXISTS channel_games (
  guild_id   TEXT NOT NULL,
  channel_id TEXT NOT NULL,
  kind       TEXT NOT NULL, -- counting | wordchain
  state      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, channel_id)
);
