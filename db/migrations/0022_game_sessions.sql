-- Minigame sessions (spec 6.16): blackjack / tictactoe / coinflip
-- challenges keep per-user state outside process memory (spec 2.5).
CREATE TABLE IF NOT EXISTS game_sessions (
  user_id    TEXT NOT NULL,
  game       TEXT NOT NULL,
  state      JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, game)
);
