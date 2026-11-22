-- Auction system (spec 6.31): timed auctions with escrow bidding.
-- The current top bid is ESCROWED: the amount leaves the bidder's
-- balance at bid time (economy_ledger source 'auction') and is
-- refunded in full the moment they are outbid. Settlement pays the
-- seller (minus the membership-based market fee) and moves the card.
CREATE TABLE IF NOT EXISTS tcg_auctions (
  id BIGSERIAL PRIMARY KEY,
  seller_id TEXT NOT NULL,
  instance_code TEXT NOT NULL,
  start_price NUMERIC(14,4) NOT NULL,
  current_price NUMERIC(14,4),
  top_bidder TEXT,
  buy_now_price NUMERIC(14,4),
  ends_at TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL DEFAULT 'open',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  settled_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_tcg_auctions_open_end ON tcg_auctions (status, ends_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_tcg_auctions_one_open_per_card
  ON tcg_auctions (instance_code) WHERE status = 'open';

CREATE TABLE IF NOT EXISTS tcg_auction_bids (
  id BIGSERIAL PRIMARY KEY,
  auction_id BIGINT NOT NULL REFERENCES tcg_auctions (id),
  bidder_id TEXT NOT NULL,
  amount NUMERIC(14,4) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_tcg_auction_bids_auction ON tcg_auction_bids (auction_id, amount DESC);
