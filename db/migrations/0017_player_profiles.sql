-- Player profiles for the /me player area (spec 6.24): the editable
-- info block shown on the game profile card (spec 6.17 mẫu thẻ).
CREATE TABLE IF NOT EXISTS player_profiles (
  user_id     TEXT PRIMARY KEY,
  gender      TEXT NOT NULL DEFAULT '',
  birthday    DATE,
  hobby       TEXT NOT NULL DEFAULT '',
  status_text TEXT NOT NULL DEFAULT '',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
