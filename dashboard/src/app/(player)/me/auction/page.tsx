import { currentSession } from "@/lib/current-session";
import { RARITY_VI } from "@/lib/tcg";
import { fmtCoins } from "@/lib/auction";
import {
  AUCTION_DURATIONS, AUCTION_MIN_START, listMyAuctions, listMyBidAuctions,
  listOpenAuctions, minNextBid, type AuctionRow,
} from "@/lib/auction";

export const metadata = { title: "Đấu giá thẻ — Puni" };

const STATUS_VI: Record<string, string> = {
  open: "Đang mở", sold: "Đã bán", unsold: "Không có người mua", cancelled: "Đã huỷ",
};

function timeLeft(endsAt: string): string {
  const ms = new Date(endsAt).getTime() - Date.now();
  if (ms <= 0) return "Đã kết thúc";
  const mins = Math.floor(ms / 60000);
  const days = Math.floor(mins / 1440);
  const hours = Math.floor((mins % 1440) / 60);
  if (days > 0) return `Còn ${days} ngày ${hours} giờ`;
  if (hours > 0) return `Còn ${hours} giờ ${mins % 60} phút`;
  return `Còn ${Math.max(1, mins)} phút`;
}

function AuctionCard({ a, me }: { a: AuctionRow; me: string }) {
  const mine = a.sellerId === me;
  const leading = a.topBidder === me;
  const price = a.currentPrice ?? a.startPrice;
  return (
    <article className="auc-card">
      {a.spriteUrl ? <img src={a.spriteUrl} alt={a.name} loading="lazy" /> : null}
      <div className="auc-body">
        <strong>{a.name}</strong>
        <span className={`mk-rar rar-${a.rarity.toLowerCase()}`}>{RARITY_VI[a.rarity] ?? a.rarity}</span>
        <span className="auc-meta">Lv.{a.level} +{a.enhance} · {a.bids} lượt trả giá</span>
        <span className="auc-price">
          {a.currentPrice != null ? fmtCoins(a.currentPrice) : fmtCoins(a.startPrice)}
          <small>{a.currentPrice != null ? " Coins · giá hiện tại" : " Coins · giá khởi điểm"}</small>
        </span>
        <span className="auc-time">{timeLeft(a.endsAt)}</span>
        {leading ? <span className="auc-tag win">Bạn đang dẫn đầu</span> : null}
        {mine ? <span className="auc-tag">Phiên của bạn</span> : null}
        {!mine && a.status === "open" ? (
          <>
            <form method="post" action="/api/me/auction" className="auc-bidform">
              <input type="hidden" name="action" value="bid" />
              <input type="hidden" name="auctionId" value={a.id} />
              <input
                type="number" name="amount" step="0.0001" min={minNextBid(a)}
                defaultValue={minNextBid(a)} aria-label="Số tiền trả giá" required
              />
              <button type="submit" className="player-btn sm">Trả giá</button>
            </form>
            {a.buyNowPrice != null ? (
              <form method="post" action="/api/me/auction">
                <input type="hidden" name="action" value="buy-now" />
                <input type="hidden" name="auctionId" value={a.id} />
                <button type="submit" className="player-btn ghost sm">
                  Mua ngay · {fmtCoins(a.buyNowPrice)} Coins
                </button>
              </form>
            ) : null}
          </>
        ) : null}
        {mine && a.status === "open" && a.topBidder == null ? (
          <form method="post" action="/api/me/auction">
            <input type="hidden" name="action" value="cancel" />
            <input type="hidden" name="auctionId" value={a.id} />
            <button type="submit" className="player-btn ghost sm">Huỷ phiên</button>
          </form>
        ) : null}
        {a.status !== "open" ? (
          <span className={`auc-tag st-${a.status}`}>{STATUS_VI[a.status] ?? a.status}</span>
        ) : null}
      </div>
    </article>
  );
}

/** Auction house (spec 6.31) — its own page, separate from the
 *  fixed-price market. Escrow bids, anti-snipe extension, lazy settle. */
export default async function AuctionPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const session = (await currentSession())!;
  const [open, mine, myBids] = await Promise.all([
    listOpenAuctions(),
    listMyAuctions(session.userId),
    listMyBidAuctions(session.userId),
  ]);
  const myBidIds = new Set(myBids.map((a) => a.id));
  const openOthers = open.filter((a) => a.sellerId !== session.userId && !myBidIds.has(a.id));

  return (
    <main className="player-main">
      <h1>Đấu giá thẻ</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}

      <section className="player-card">
        <h2 className="mk-h2">Tạo phiên đấu giá</h2>
        <form method="post" action="/api/me/auction" className="auc-create">
          <input type="hidden" name="action" value="create" />
          <label>
            Mã thẻ (8 ký tự)
            <input type="text" name="code" maxLength={8} placeholder="VD: SHWCASE2" required />
          </label>
          <label>
            Giá khởi điểm (Coins)
            <input type="number" name="startPrice" step="0.0001" min={AUCTION_MIN_START} placeholder="Từ 10" required />
          </label>
          <label>
            Thời lượng
            <select name="hours" defaultValue={24}>
              {AUCTION_DURATIONS.map((d) => (
                <option key={d.hours} value={d.hours}>{d.name}</option>
              ))}
            </select>
          </label>
          <label>
            Giá mua ngay (tuỳ chọn)
            <input type="number" name="buyNow" step="0.0001" placeholder="Để trống nếu không có" />
          </label>
          <button type="submit" className="player-btn">Tạo phiên</button>
        </form>
      </section>

      <h2 className="mk-h2">Đang diễn ra</h2>
      {openOthers.length === 0 ? (
        <p className="player-sub">Chưa có phiên nào của người chơi khác đang mở.</p>
      ) : (
        <div className="auc-grid">
          {openOthers.map((a) => (
            <AuctionCard key={a.id} a={a} me={session.userId} />
          ))}
        </div>
      )}

      {myBids.length > 0 ? (
        <>
          <h2 className="mk-h2">Tôi đang tham gia</h2>
          <div className="auc-grid">
            {myBids.map((a) => (
              <AuctionCard key={a.id} a={a} me={session.userId} />
            ))}
          </div>
        </>
      ) : null}

      {mine.length > 0 ? (
        <>
          <h2 className="mk-h2">Phiên của tôi</h2>
          <div className="auc-grid">
            {mine.map((a) => (
              <AuctionCard key={a.id} a={a} me={session.userId} />
            ))}
          </div>
        </>
      ) : null}
    </main>
  );
}
