-- Shop system removed entirely (owner ruling 2026-11-21 18:41):
-- Puni is a community-only bot with its own separate data.
-- shop_enabled gated the (never-built) shop commands; board_state was
-- built ahead for shop price boards and never used by any code path.
ALTER TABLE guild_settings DROP COLUMN IF EXISTS shop_enabled;
DROP TABLE IF EXISTS board_state;
