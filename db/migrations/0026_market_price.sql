-- Gia thi truong NOI BO cua tung loai the (dac ta 6.29): gia APITCG chi
-- la gia khoi diem (price_usd); tu khi van hanh, gia tham chieu cua loai
-- the dich theo giao dich cho nguoi choi that. market_price_coins trong
-- thi loai do chua tung co giao dich (gia tri tinh tu price_usd).
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS market_price_coins NUMERIC(14, 4);
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS market_sales INTEGER NOT NULL DEFAULT 0;
