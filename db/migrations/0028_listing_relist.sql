-- Cho phep dang ban LAI mot the da tung ban/huy (dac ta 6.29): truoc
-- day instance_code bi UNIQUE tren moi trang thai nen the da giao dich
-- mot lan thi khong bao gio dang ban lai duoc. Giu dung mot rang buoc
-- that su can: moi the chi co TOI DA MOT tin dang mo tai mot thoi diem
-- (index unique mot phan), con lich su cac tin cu thi giu nguyen.
ALTER TABLE tcg_listings DROP CONSTRAINT IF EXISTS tcg_listings_instance_code_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_tcg_listings_open_instance
  ON tcg_listings (instance_code) WHERE status = 'open';
