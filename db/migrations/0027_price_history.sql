-- Lich su gia thi truong NOI BO (dac ta 6.29): moi giao dich cho hoan
-- tat ghi mot diem gia tham chieu moi cua loai the — lam duong gia cho
-- trang cho va lam co so tinh xu huong, thay cho viec chi dua vao gia
-- ban trung binh theo ngay (qua thua khi it giao dich).
CREATE TABLE IF NOT EXISTS tcg_price_history (
  id BIGSERIAL PRIMARY KEY,
  species_id TEXT NOT NULL,
  price NUMERIC(14, 4) NOT NULL,
  sale_price NUMERIC(14, 4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tcg_price_history_species ON tcg_price_history (species_id, created_at);
