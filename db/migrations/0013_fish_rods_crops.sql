-- Fishing + farming content (spec 6.20 + 6.21). Fish get their OWN
-- table (they carry a rarity tier and a member-exclusive flag the
-- generic item table should not model), rods are the fishing gear
-- catalogue, and crops model the farm loop seed → grow → harvest.

CREATE TABLE IF NOT EXISTS game_fish (
  id TEXT PRIMARY KEY,               -- slug
  name TEXT NOT NULL,
  rarity TEXT NOT NULL DEFAULT 'common',  -- common|uncommon|rare|epic|legendary
  description TEXT NOT NULL DEFAULT '',
  member_exclusive BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_fish_rarity_idx ON game_fish (rarity, enabled);

CREATE TABLE IF NOT EXISTS game_rods (
  id TEXT PRIMARY KEY,               -- slug
  name TEXT NOT NULL,
  price_coins BIGINT NOT NULL DEFAULT 0,
  price_gems BIGINT NOT NULL DEFAULT 0,
  -- Percent added to the roll weights of rare+ tiers (0..500).
  rare_bonus_percent INT NOT NULL DEFAULT 0,
  -- Multiplier on the fishing cooldown, percent (100 = unchanged).
  cooldown_percent INT NOT NULL DEFAULT 100,
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_crops (
  id TEXT PRIMARY KEY,               -- slug
  name TEXT NOT NULL,                -- cây trồng, vd 'Cà chua'
  seed_price_coins BIGINT NOT NULL DEFAULT 0,
  seed_price_gems BIGINT NOT NULL DEFAULT 0,
  grow_minutes INT NOT NULL DEFAULT 60,
  yield_min INT NOT NULL DEFAULT 1,
  yield_max INT NOT NULL DEFAULT 1,
  sell_price BIGINT NOT NULL DEFAULT 0,  -- per harvested unit, Coins
  description TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
