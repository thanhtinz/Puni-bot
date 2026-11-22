-- Werewolf / Ma sói (spec 6.16.4): full game state as JSONB in the
-- store (architecture law 2.5), an announcement outbox the shard
-- tick drains (role DMs + phase posts), and fame-only stats.
-- Werewolf never touches the economy — no columns link the two.
CREATE TABLE IF NOT EXISTS werewolf_games (
  id            BIGSERIAL PRIMARY KEY,
  guild_id      TEXT NOT NULL,
  channel_id    TEXT NOT NULL,
  host_id       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'lobby',  -- lobby|playing|finished|cancelled
  state         JSONB NOT NULL,
  stats_recorded BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  finished_at   TIMESTAMPTZ
);
-- One active game per channel.
CREATE UNIQUE INDEX IF NOT EXISTS werewolf_games_one_active_channel
  ON werewolf_games (channel_id) WHERE status IN ('lobby', 'playing');
CREATE INDEX IF NOT EXISTS werewolf_games_due
  ON werewolf_games (status) WHERE status = 'playing';

CREATE TABLE IF NOT EXISTS werewolf_outbox (
  id         BIGSERIAL PRIMARY KEY,
  kind       TEXT NOT NULL,  -- channel|dm
  target_id  TEXT NOT NULL,
  text       TEXT NOT NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS werewolf_outbox_pending
  ON werewolf_outbox (claimed_at, id);

CREATE TABLE IF NOT EXISTS werewolf_stats (
  guild_id       TEXT NOT NULL,
  user_id        TEXT NOT NULL,
  games          INT NOT NULL DEFAULT 0,
  wins           INT NOT NULL DEFAULT 0,
  wolf_games     INT NOT NULL DEFAULT 0,
  wolf_wins      INT NOT NULL DEFAULT 0,
  village_games  INT NOT NULL DEFAULT 0,
  village_wins   INT NOT NULL DEFAULT 0,
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, user_id)
);
