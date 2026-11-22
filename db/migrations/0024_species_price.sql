-- Gia thi truong that cua la bai (USD, tu APITCG/TCGplayer — dac ta 6.29).
-- Gia tri Coins cua the quy doi tu cot nay x ti gia trong tcg_config
-- (priceCoinsPerUsd); la khong co gia thi lui ve bang gia theo do hiem.
ALTER TABLE game_species ADD COLUMN IF NOT EXISTS price_usd NUMERIC(12, 2);
