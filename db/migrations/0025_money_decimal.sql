-- Coins giu so le nhu gia thi truong (dac ta 6.29, Tin chot 2026-11-22):
-- gia the la USD 2 so le, he so cap/cuong hoa nhan vao ra toi da 4 so le.
-- So du va so cai chuyen tu BIGINT sang NUMERIC(14,4) de ban the tra
-- dung tung phan le, khong lam tron. Cac khoan nguyen (goi the, cuoc,
-- daily...) khong doi hanh vi.
ALTER TABLE economy_accounts ALTER COLUMN balance TYPE NUMERIC(14, 4) USING balance::numeric;
ALTER TABLE economy_ledger ALTER COLUMN delta TYPE NUMERIC(14, 4) USING delta::numeric;
ALTER TABLE economy_ledger ALTER COLUMN balance_after TYPE NUMERIC(14, 4) USING balance_after::numeric;
