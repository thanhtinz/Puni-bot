import { db } from "@/lib/db";
import {
  adjustBalanceTx, fmtCoins, nextMarketPrice, sellerFeePercent, snapMoney,
} from "@/lib/player";
import { BASE_VALUE, getPriceCoinsPerUsd } from "@/lib/tcg";

export { fmtCoins };

/** Auction system (spec 6.31) — separate from the fixed-price market.
 *  Bids are escrowed at bid time and refunded the moment the bidder is
 *  outbid. Expired auctions settle lazily on read/action (no cron
 *  needed on the web surface); every money move is one transaction. */

export const AUCTION_DURATIONS = [
  { hours: 1, name: "1 giờ" },
  { hours: 6, name: "6 giờ" },
  { hours: 24, name: "24 giờ" },
  { hours: 72, name: "3 ngày" },
] as const;
export const AUCTION_MIN_START = 10;
const ANTI_SNIPE_MS = 5 * 60 * 1000;

type TxResult = { ok: true } | { ok: false; error: string };
type TxClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, never>[]; rowCount?: number | null }>;
};

export interface AuctionRow {
  id: number;
  sellerId: string;
  instanceCode: string;
  startPrice: number;
  currentPrice: number | null;
  topBidder: string | null;
  buyNowPrice: number | null;
  endsAt: string;
  status: string;
  createdAt: string;
  name: string;
  rarity: string;
  spriteUrl: string;
  level: number;
  enhance: number;
  bids: number;
}

export function minNextBid(a: { startPrice: number; currentPrice: number | null }): number {
  if (a.currentPrice == null) return a.startPrice;
  return snapMoney(a.currentPrice + Math.max(5, a.currentPrice * 0.05));
}

function parseAmount(raw: string): number | null {
  const n = Number.parseFloat(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return snapMoney(n);
}

/** Record a completed auction sale into the internal market — mirrors
 *  buyListingWeb's price update (spec 6.29) in the same transaction. */
async function recordAuctionSaleTx(client: TxClient, instanceCode: string, price: number): Promise<void> {
  const inst = await client.query(`SELECT species_id FROM tcg_instances WHERE code = $1`, [instanceCode]);
  const speciesId = inst.rows[0]?.species_id as string | undefined;
  if (!speciesId) return;
  const sp = await client.query(
    `SELECT rarity, price_usd::text AS price_usd, market_price_coins::text AS mpc, market_sales
     FROM game_species WHERE id = $1 FOR UPDATE`,
    [speciesId],
  );
  const s = sp.rows[0];
  if (!s) return;
  const rate = await getPriceCoinsPerUsd();
  const seed = s.price_usd != null && Number(s.price_usd) > 0
    ? Number(s.price_usd) * rate
    : (BASE_VALUE[s.rarity as string] ?? 0);
  const next = nextMarketPrice(
    s.mpc != null ? Number(s.mpc) : null, seed, price, Number(s.market_sales ?? 0),
  );
  await client.query(
    `UPDATE game_species SET market_price_coins = $1, market_sales = market_sales + 1 WHERE id = $2`,
    [next, speciesId],
  );
  await client.query(
    `INSERT INTO tcg_price_history (species_id, price, sale_price) VALUES ($1, $2, $3)`,
    [speciesId, next, price],
  );
}

/** Pay the seller (minus their membership fee) and move the card. */
async function settleWonTx(
  client: TxClient,
  a: { id: number; seller_id: string; instance_code: string; current_price: string; top_bidder: string },
): Promise<void> {
  const price = Number(a.current_price);
  const feePct = await sellerFeePercent(a.seller_id);
  const sellerGets = snapMoney(price - (price * feePct) / 100);
  await adjustBalanceTx(client, a.seller_id, sellerGets, "auction", `Thắng đấu giá thẻ ${a.instance_code}`);
  await client.query(`UPDATE tcg_instances SET user_id = $1 WHERE code = $2`, [a.top_bidder, a.instance_code]);
  await client.query(
    `UPDATE tcg_auctions SET status = 'sold', settled_at = now() WHERE id = $1`,
    [a.id],
  );
  await recordAuctionSaleTx(client, a.instance_code, price);
}

/** Settle every expired open auction. Safe to call on any read. */
export async function settleExpiredAuctions(): Promise<void> {
  try {
    const due = await db().query(
      `SELECT id FROM tcg_auctions WHERE status = 'open' AND ends_at <= now() ORDER BY ends_at LIMIT 50`,
    );
    for (const row of due.rows as { id: number }[]) {
      const client = await db().connect();
      try {
        await client.query("BEGIN");
        const res = await client.query(
          `SELECT id, seller_id, instance_code, current_price::text AS current_price, top_bidder
           FROM tcg_auctions WHERE id = $1 AND status = 'open' AND ends_at <= now() FOR UPDATE`,
          [row.id],
        );
        const a = res.rows[0] as unknown as {
          id: number; seller_id: string; instance_code: string;
          current_price: string | null; top_bidder: string | null;
        } | undefined;
        if (a) {
          if (a.top_bidder && a.current_price != null) {
            await settleWonTx(client, { ...a, current_price: a.current_price, top_bidder: a.top_bidder });
          } else {
            await client.query(
              `UPDATE tcg_auctions SET status = 'unsold', settled_at = now() WHERE id = $1`,
              [a.id],
            );
          }
        }
        await client.query("COMMIT");
      } catch {
        await client.query("ROLLBACK").catch(() => undefined);
      } finally {
        client.release();
      }
    }
  } catch {
    /* settlement is best-effort per read; the next read retries */
  }
}

export async function createAuction(
  userId: string,
  code: string,
  startPriceRaw: string,
  hours: number,
  buyNowRaw: string,
): Promise<TxResult> {
  const startPrice = parseAmount(startPriceRaw);
  if (startPrice == null || startPrice < AUCTION_MIN_START) {
    return { ok: false, error: `Giá khởi điểm tối thiểu ${AUCTION_MIN_START} Coins.` };
  }
  if (!AUCTION_DURATIONS.some((d) => d.hours === hours)) {
    return { ok: false, error: "Thời lượng phiên không hợp lệ." };
  }
  let buyNow: number | null = null;
  if (buyNowRaw.trim() !== "") {
    buyNow = parseAmount(buyNowRaw);
    if (buyNow == null || buyNow <= startPrice) {
      return { ok: false, error: "Giá mua ngay phải lớn hơn giá khởi điểm." };
    }
  }
  const clean = code.trim().toUpperCase();
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const inst = await client.query(
      `SELECT locked, favorite FROM tcg_instances WHERE code = $1 AND user_id = $2 FOR UPDATE`,
      [clean, userId],
    );
    const row = inst.rows[0] as unknown as { locked: boolean; favorite: boolean } | undefined;
    if (!row) { await client.query("ROLLBACK"); return { ok: false, error: "Không tìm thấy thẻ đó trong kho của bạn." }; }
    if (row.locked || row.favorite) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ khoá/yêu thích không đấu giá được." }; }
    const inDeck = await client.query(`SELECT 1 FROM tcg_deck_cards WHERE instance_code = $1`, [clean]);
    if (inDeck.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đang trong bộ bài — gỡ ra trước khi đấu giá." }; }
    const listed = await client.query(`SELECT 1 FROM tcg_listings WHERE instance_code = $1 AND status = 'open'`, [clean]);
    if (listed.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đang có tin bán trên chợ — huỷ tin trước." }; }
    const open = await client.query(`SELECT 1 FROM tcg_auctions WHERE instance_code = $1 AND status = 'open'`, [clean]);
    if (open.rows.length) { await client.query("ROLLBACK"); return { ok: false, error: "Thẻ đang ở trong một phiên đấu giá rồi." }; }
    await client.query(
      `INSERT INTO tcg_auctions (seller_id, instance_code, start_price, buy_now_price, ends_at)
       VALUES ($1, $2, $3, $4, now() + ($5 || ' hours')::interval)`,
      [userId, clean, startPrice, buyNow, String(hours)],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi tạo phiên, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function placeBid(userId: string, auctionId: number, amountRaw: string): Promise<TxResult> {
  const amount = parseAmount(amountRaw);
  if (amount == null) return { ok: false, error: "Số tiền trả giá không hợp lệ." };
  await settleExpiredAuctions();
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `SELECT id, seller_id, instance_code, start_price::text AS sp, current_price::text AS cp,
              top_bidder, ends_at
       FROM tcg_auctions WHERE id = $1 AND status = 'open' FOR UPDATE`,
      [auctionId],
    );
    const a = res.rows[0] as unknown as {
      id: number; seller_id: string; instance_code: string; sp: string;
      cp: string | null; top_bidder: string | null; ends_at: string;
    } | undefined;
    if (!a) { await client.query("ROLLBACK"); return { ok: false, error: "Phiên đấu giá này không còn nữa." }; }
    if (new Date(a.ends_at).getTime() <= Date.now()) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Phiên đã kết thúc." };
    }
    if (a.seller_id === userId) { await client.query("ROLLBACK"); return { ok: false, error: "Không tự trả giá phiên của mình được." }; }
    const startPrice = Number(a.sp);
    const currentPrice = a.cp != null ? Number(a.cp) : null;
    const min = minNextBid({ startPrice, currentPrice });
    if (amount < min) {
      await client.query("ROLLBACK");
      return { ok: false, error: `Giá tối thiểu lúc này là ${fmtCoins(min)} Coins.` };
    }
    if (a.top_bidder === userId && currentPrice != null) {
      // Raising your own top bid: only the difference is charged.
      const diff = snapMoney(amount - currentPrice);
      const paid = await adjustBalanceTx(client, userId, -diff, "auction", `Nâng giá phiên #${a.id} (giữ chỗ)`);
      if (!paid) { await client.query("ROLLBACK"); return { ok: false, error: "Số dư Coins không đủ." }; }
    } else {
      const paid = await adjustBalanceTx(client, userId, -amount, "auction", `Trả giá phiên #${a.id} (giữ chỗ)`);
      if (!paid) { await client.query("ROLLBACK"); return { ok: false, error: "Số dư Coins không đủ." }; }
      if (a.top_bidder && currentPrice != null) {
        await adjustBalanceTx(client, a.top_bidder, currentPrice, "auction", `Hoàn tiền bị vượt giá phiên #${a.id}`);
      }
    }
    await client.query(
      `UPDATE tcg_auctions SET current_price = $1, top_bidder = $2 WHERE id = $3`,
      [amount, userId, a.id],
    );
    await client.query(
      `INSERT INTO tcg_auction_bids (auction_id, bidder_id, amount) VALUES ($1, $2, $3)`,
      [a.id, userId, amount],
    );
    // Anti-snipe: a bid inside the last 5 minutes extends the auction.
    if (new Date(a.ends_at).getTime() - Date.now() < ANTI_SNIPE_MS) {
      await client.query(`UPDATE tcg_auctions SET ends_at = now() + interval '5 minutes' WHERE id = $1`, [a.id]);
    }
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi trả giá, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function buyNowAuction(userId: string, auctionId: number): Promise<TxResult> {
  await settleExpiredAuctions();
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `SELECT id, seller_id, instance_code, current_price::text AS cp, top_bidder,
              buy_now_price::text AS bnp, ends_at
       FROM tcg_auctions WHERE id = $1 AND status = 'open' FOR UPDATE`,
      [auctionId],
    );
    const a = res.rows[0] as unknown as {
      id: number; seller_id: string; instance_code: string; cp: string | null;
      top_bidder: string | null; bnp: string | null; ends_at: string;
    } | undefined;
    if (!a) { await client.query("ROLLBACK"); return { ok: false, error: "Phiên đấu giá này không còn nữa." }; }
    if (a.bnp == null) { await client.query("ROLLBACK"); return { ok: false, error: "Phiên này không có giá mua ngay." }; }
    if (new Date(a.ends_at).getTime() <= Date.now()) { await client.query("ROLLBACK"); return { ok: false, error: "Phiên đã kết thúc." }; }
    if (a.seller_id === userId) { await client.query("ROLLBACK"); return { ok: false, error: "Không mua ngay phiên của chính mình được." }; }
    const buyNow = Number(a.bnp);
    const currentPrice = a.cp != null ? Number(a.cp) : null;
    if (a.top_bidder === userId && currentPrice != null) {
      const diff = snapMoney(buyNow - currentPrice);
      const paid = await adjustBalanceTx(client, userId, -diff, "auction", `Mua ngay phiên #${a.id} (trừ phần đã giữ)`);
      if (!paid) { await client.query("ROLLBACK"); return { ok: false, error: "Số dư Coins không đủ." }; }
    } else {
      const paid = await adjustBalanceTx(client, userId, -buyNow, "auction", `Mua ngay phiên #${a.id}`);
      if (!paid) { await client.query("ROLLBACK"); return { ok: false, error: "Số dư Coins không đủ." }; }
      if (a.top_bidder && currentPrice != null) {
        await adjustBalanceTx(client, a.top_bidder, currentPrice, "auction", `Hoàn tiền bị mua ngay phiên #${a.id}`);
      }
    }
    await client.query(`UPDATE tcg_auctions SET current_price = $1, top_bidder = $2 WHERE id = $3`, [buyNow, userId, a.id]);
    await settleWonTx(client, {
      id: a.id, seller_id: a.seller_id, instance_code: a.instance_code,
      current_price: String(buyNow), top_bidder: userId,
    });
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi mua ngay, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function cancelAuction(userId: string, auctionId: number): Promise<TxResult> {
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const res = await client.query(
      `SELECT id, seller_id, top_bidder FROM tcg_auctions WHERE id = $1 AND status = 'open' FOR UPDATE`,
      [auctionId],
    );
    const a = res.rows[0] as unknown as { id: number; seller_id: string; top_bidder: string | null } | undefined;
    if (!a) { await client.query("ROLLBACK"); return { ok: false, error: "Phiên không còn mở nữa." }; }
    if (a.seller_id !== userId) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Đây không phải phiên của bạn." };
    }
    if (a.top_bidder) { await client.query("ROLLBACK"); return { ok: false, error: "Đã có người trả giá — không huỷ được nữa." }; }
    await client.query(`UPDATE tcg_auctions SET status = 'cancelled', settled_at = now() WHERE id = $1`, [auctionId]);
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi huỷ phiên, thử lại sau." };
  } finally {
    client.release();
  }
}

const AUCTION_SELECT = `
  SELECT a.id, a.seller_id, a.instance_code, a.start_price::text AS sp,
         a.current_price::text AS cp, a.top_bidder, a.buy_now_price::text AS bnp,
         a.ends_at::text AS ends_at, a.status, a.created_at::text AS created_at,
         s.name, s.rarity, s.sprite_url, i.level, i.enhance,
         (SELECT COUNT(*)::int FROM tcg_auction_bids b WHERE b.auction_id = a.id) AS bids
  FROM tcg_auctions a
  JOIN tcg_instances i ON i.code = a.instance_code
  JOIN game_species s ON s.id = i.species_id`;

function mapAuction(r: Record<string, unknown>): AuctionRow {
  return {
    id: Number(r.id),
    sellerId: String(r.seller_id),
    instanceCode: String(r.instance_code),
    startPrice: Number(r.sp),
    currentPrice: r.cp != null ? Number(r.cp) : null,
    topBidder: r.top_bidder != null ? String(r.top_bidder) : null,
    buyNowPrice: r.bnp != null ? Number(r.bnp) : null,
    endsAt: String(r.ends_at),
    status: String(r.status),
    createdAt: String(r.created_at),
    name: String(r.name),
    rarity: String(r.rarity),
    spriteUrl: String(r.sprite_url ?? ""),
    level: Number(r.level),
    enhance: Number(r.enhance),
    bids: Number(r.bids ?? 0),
  };
}

export async function listOpenAuctions(): Promise<AuctionRow[]> {
  await settleExpiredAuctions();
  const res = await db().query(`${AUCTION_SELECT} WHERE a.status = 'open' ORDER BY a.ends_at ASC LIMIT 60`);
  return (res.rows as Record<string, unknown>[]).map(mapAuction);
}

export async function listMyAuctions(userId: string): Promise<AuctionRow[]> {
  await settleExpiredAuctions();
  const res = await db().query(
    `${AUCTION_SELECT} WHERE a.seller_id = $1 ORDER BY a.created_at DESC LIMIT 30`,
    [userId],
  );
  return (res.rows as Record<string, unknown>[]).map(mapAuction);
}

export async function listMyBidAuctions(userId: string): Promise<AuctionRow[]> {
  await settleExpiredAuctions();
  const res = await db().query(
    `${AUCTION_SELECT} WHERE a.id IN (SELECT DISTINCT auction_id FROM tcg_auction_bids WHERE bidder_id = $1)
     ORDER BY a.ends_at ASC LIMIT 30`,
    [userId],
  );
  return (res.rows as Record<string, unknown>[]).map(mapAuction);
}
