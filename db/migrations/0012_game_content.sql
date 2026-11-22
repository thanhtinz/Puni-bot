-- Cozy World content database (spec 6.17 + Admin content management).
-- Species, items and the in-game shop catalogue are OWNER-MANAGED in
-- the Admin panel — the game (GĐ9) reads these tables instead of any
-- hardcoded content list. The Tuxemon import (GĐ9) will land in
-- game_species as rows, editable here like any other row.

CREATE TABLE IF NOT EXISTS game_species (
  id TEXT PRIMARY KEY,               -- slug, e.g. 'rockitten'
  name TEXT NOT NULL,
  types TEXT NOT NULL DEFAULT '',    -- comma list, e.g. 'Đất, Lửa'
  rarity TEXT NOT NULL DEFAULT 'Common',
  base_hp INT NOT NULL DEFAULT 50,
  base_atk INT NOT NULL DEFAULT 50,
  base_def INT NOT NULL DEFAULT 50,
  base_spd INT NOT NULL DEFAULT 50,
  description TEXT NOT NULL DEFAULT '',
  sprite_url TEXT NOT NULL DEFAULT '',
  member_exclusive BOOLEAN NOT NULL DEFAULT false,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS game_items (
  id TEXT PRIMARY KEY,               -- slug, e.g. 'hat-giong-ca-chua'
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',  -- seed|crop|farm_tool|consumable|material|other
  price_coins BIGINT NOT NULL DEFAULT 0,
  price_gems BIGINT NOT NULL DEFAULT 0,
  sell_price BIGINT NOT NULL DEFAULT 0,
  description TEXT NOT NULL DEFAULT '',
  icon_url TEXT NOT NULL DEFAULT '',
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS game_items_category_idx ON game_items (category);

-- In-game shop: which items are on sale, with optional price overrides
-- and stock (NULL stock = unlimited). Prices fall back to game_items.
CREATE TABLE IF NOT EXISTS game_shop_listings (
  id BIGSERIAL PRIMARY KEY,
  item_id TEXT NOT NULL REFERENCES game_items(id) ON DELETE CASCADE,
  price_coins BIGINT,
  price_gems BIGINT,
  stock INT,
  sort INT NOT NULL DEFAULT 0,
  enabled BOOLEAN NOT NULL DEFAULT true,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (item_id)
);
