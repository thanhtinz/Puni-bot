-- Membership purchase orders (spec 6.19 purchase flow). Created from
-- the public /membership page (pick tier + Discord ID → VietQR), the
-- order code doubles as the bank-transfer content so payments can be
-- matched. Confirmation (Admin button or payment webhook) flips the
-- order to 'paid' and grants the membership in the same step.
CREATE TABLE IF NOT EXISTS membership_orders (
  id BIGSERIAL PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,          -- e.g. 'PUNI-8F3K2' — transfer content
  user_id TEXT NOT NULL,              -- Discord ID typed by the buyer
  tier_id TEXT NOT NULL,
  tier_name TEXT NOT NULL,            -- snapshot at purchase time
  amount BIGINT NOT NULL,             -- VNĐ snapshot at purchase time
  days INT NOT NULL DEFAULT 30,
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | paid | cancelled
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  paid_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS membership_orders_user_idx ON membership_orders (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS membership_orders_status_idx ON membership_orders (status, created_at DESC);
