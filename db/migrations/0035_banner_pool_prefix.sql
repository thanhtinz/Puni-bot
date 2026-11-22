-- 0035: banner theo từng game (Tín lệnh 2026-11-22 "nhiều game mà, ít banner").
-- pool_prefix: khi pool_species rỗng và pool_prefix có giá trị, pool của banner
-- là mọi loài có id bắt đầu bằng tiền tố đó (mỗi game một tiền tố loài riêng).
ALTER TABLE tcg_banners ADD COLUMN IF NOT EXISTS pool_prefix TEXT;

INSERT INTO tcg_banners (id, name, kind, featured_species, pool_species, pool_prefix, cost_coins, image_url, enabled) VALUES
  ('pokemon', 'Pokémon', 'limited', ARRAY['pkm-hp-103-110','pkm-30c-r-rgb'], '{}', 'pkm-', 500, '/packs/pokemon-pack.jpg', TRUE),
  ('magic', 'Magic: The Gathering', 'limited', ARRAY['mtg-ptp-299','mtg-slp-17'], '{}', 'mtg-', 500, '/packs/magic-pack.jpg', TRUE),
  ('yugioh', 'Yu-Gi-Oh!', 'limited', ARRAY['ygo-tp1-tp1-001','ygo-wcjpp-2018-jpp01'], '{}', 'ygo-', 500, '/packs/yugioh-pack.jpg', TRUE),
  ('digimon', 'Digimon', 'limited', ARRAY['dig-ex-12-ex12-076-sec','dig-ad-01-ad1-008-sr'], '{}', 'dig-', 500, '/packs/digimon-pack.jpg', TRUE),
  ('lorcana', 'Disney Lorcana', 'limited', ARRAY['lor-dlpc-17','lor-dlpc-15'], '{}', 'lor-', 500, '/packs/lorcana-pack.jpg', TRUE),
  ('db-fusion', 'Dragon Ball Fusion World', 'limited', ARRAY['dbf-sb02-fb01-140','dbf-dbsfw-tpr-fb07-104'], '{}', 'dbf-', 500, '/packs/db-fusion-pack.jpg', TRUE),
  ('db-masters', 'Dragon Ball Super Masters', 'limited', ARRAY['dbm-bt25-bt25-146','dbm-bt26-bt26-138'], '{}', 'dbm-', 500, '/packs/db-masters-pack.jpg', TRUE),
  ('final-fantasy', 'Final Fantasy TCG', 'limited', ARRAY['ff-24-19-119l','ff-pr-pr-085'], '{}', 'ff-', 500, '/packs/final-fantasy-pack.jpg', TRUE),
  ('flesh-and-blood', 'Flesh and Blood', 'limited', ARRAY['fab-dyn-dyn000','fab-pr-fab015'], '{}', 'fab-', 500, '/packs/flesh-and-blood-pack.jpg', TRUE),
  ('gundam', 'Gundam Card Game', 'limited', ARRAY['gun-gd02-gd02-054','gun-gcg-pr-gd02-091'], '{}', 'gun-', 500, '/packs/gundam-pack.jpg', TRUE),
  ('star-wars', 'Star Wars: Unlimited', 'limited', ARRAY['swu-opp-103','swu-jdg-117'], '{}', 'swu-', 500, '/packs/star-wars-pack.jpg', TRUE),
  ('union-arena', 'Union Arena', 'limited', ARRAY['una-uepr-uepr-kgr-1-060','una-uepr-uepr-mha-1-018'], '{}', 'una-', 500, '/packs/union-arena-pack.jpg', TRUE),
  ('vanguard', 'Cardfight!! Vanguard', 'limited', ARRAY['cfv-d-pr-d-pr-466en','cfv-d-pr-d-pr-473en'], '{}', 'cfv-', 500, '/packs/vanguard-pack.jpg', TRUE),
  ('mitos', 'Mitos y Leyendas', 'limited', '{}', '{}', 'myl-', 500, '/pack-tuxemon.png', TRUE),
  ('riftbound', 'Riftbound', 'limited', ARRAY['rift-jdg-111-298','rift-opp-193-298'], '{}', 'rift-', 500, '/packs/riftbound-pack.jpg', TRUE),
  ('palworld', 'Palworld', 'limited', ARRAY['pal-pr-epr-018','pal-pr-epr-002s'], '{}', 'pal-', 500, '/packs/palworld-pack.jpg', TRUE),
  ('cyberpunk', 'Cyberpunk TCG', 'limited', ARRAY['cyb-jdg-005','cyb-cyberpunk-set-1-promos-002'], '{}', 'cyb-', 500, '/packs/cyberpunk-pack.jpg', TRUE),
  ('hololive', 'hololive OCG', 'limited', ARRAY['holo-sd03e-hsd03-010','holo-sd03e-hsd03-011'], '{}', 'holo-', 500, '/packs/hololive-pack.jpg', TRUE)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name, kind = EXCLUDED.kind,
  featured_species = EXCLUDED.featured_species,
  pool_prefix = EXCLUDED.pool_prefix,
  cost_coins = EXCLUDED.cost_coins,
  image_url = EXCLUDED.image_url,
  enabled = TRUE;
