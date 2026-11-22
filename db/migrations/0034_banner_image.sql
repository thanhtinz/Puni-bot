-- 0034: ảnh bìa cho banner gacha (đặc tả 6.34) — ảnh gói nguyên seal của bộ
-- thẻ gắn với banner; banner chung dùng ảnh gói Puni mặc định.
ALTER TABLE tcg_banners ADD COLUMN IF NOT EXISTS image_url TEXT;

UPDATE tcg_banners SET image_url = '/pack-tuxemon.png'
 WHERE id IN ('standard', 'beginner') AND image_url IS NULL;

UPDATE tcg_banners SET image_url = '/packs/op01-romance-dawn-pack.jpg'
 WHERE id = 'one-piece' AND image_url IS NULL;
