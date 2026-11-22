-- TCG card game (spec 6.23). Cards are the Tuxemon species catalog
-- (game_species); every owned card is an instance row here.
CREATE TABLE IF NOT EXISTS tcg_instances (
  code TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  species_id TEXT NOT NULL REFERENCES game_species (id),
  level INT NOT NULL DEFAULT 1,
  xp INT NOT NULL DEFAULT 0,
  enhance INT NOT NULL DEFAULT 0,
  locked BOOLEAN NOT NULL DEFAULT false,
  favorite BOOLEAN NOT NULL DEFAULT false,
  obtained TEXT NOT NULL DEFAULT 'gacha',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tcg_instances_user_idx ON tcg_instances (user_id, species_id);

CREATE TABLE IF NOT EXISTS tcg_banners (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'standard', -- standard|limited|event|beginner
  featured_species TEXT[] NOT NULL DEFAULT '{}',
  pool_species TEXT[] NOT NULL DEFAULT '{}', -- empty = full catalog
  cost_coins BIGINT NOT NULL DEFAULT 500,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  enabled BOOLEAN NOT NULL DEFAULT true
);

CREATE TABLE IF NOT EXISTS tcg_pity (
  user_id TEXT NOT NULL,
  banner_id TEXT NOT NULL REFERENCES tcg_banners (id),
  since_epic INT NOT NULL DEFAULT 0,
  since_legendary INT NOT NULL DEFAULT 0,
  total_pulls INT NOT NULL DEFAULT 0,
  summon_points INT NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, banner_id)
);

CREATE TABLE IF NOT EXISTS tcg_pulls (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  banner_id TEXT NOT NULL,
  species_id TEXT NOT NULL,
  rarity TEXT NOT NULL,
  instance_code TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tcg_pulls_user_idx ON tcg_pulls (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS tcg_wallets (
  user_id TEXT PRIMARY KEY,
  shards BIGINT NOT NULL DEFAULT 0,
  packs_standard INT NOT NULL DEFAULT 0,
  packs_premium INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS tcg_claims (
  user_id TEXT NOT NULL,
  kind TEXT NOT NULL, -- daily | weekly
  period TEXT NOT NULL, -- 2026-11-21 | 2026-W47
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, kind, period)
);

CREATE TABLE IF NOT EXISTS tcg_decks (
  id BIGSERIAL PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS tcg_decks_user_idx ON tcg_decks (user_id);

CREATE TABLE IF NOT EXISTS tcg_deck_cards (
  deck_id BIGINT NOT NULL REFERENCES tcg_decks (id) ON DELETE CASCADE,
  instance_code TEXT NOT NULL REFERENCES tcg_instances (code),
  PRIMARY KEY (deck_id, instance_code)
);

CREATE TABLE IF NOT EXISTS tcg_listings (
  id BIGSERIAL PRIMARY KEY,
  seller_id TEXT NOT NULL,
  instance_code TEXT NOT NULL UNIQUE REFERENCES tcg_instances (code),
  price BIGINT NOT NULL,
  status TEXT NOT NULL DEFAULT 'open', -- open|sold|cancelled|expired
  buyer_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  sold_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS tcg_listings_open_idx ON tcg_listings (status, price);

CREATE TABLE IF NOT EXISTS tcg_trades (
  id BIGSERIAL PRIMARY KEY,
  from_user TEXT NOT NULL,
  to_user TEXT NOT NULL,
  offer_codes TEXT[] NOT NULL DEFAULT '{}',
  offer_coins BIGINT NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending', -- pending|accepted|rejected|cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS tcg_achievements (
  user_id TEXT NOT NULL,
  achievement_id TEXT NOT NULL,
  claimed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, achievement_id)
);

CREATE TABLE IF NOT EXISTS tcg_settings (
  user_id TEXT PRIMARY KEY,
  prefs JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO tcg_banners (id, name, kind, cost_coins) VALUES
  ('standard', 'Banner Chuẩn', 'standard', 500),
  ('beginner', 'Banner Tân Thủ', 'beginner', 250)
ON CONFLICT (id) DO NOTHING;
