import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { myMarketHistory, openListings, RARITY_VI } from "@/lib/tcg";
import { db } from "@/lib/db";
import { MarketSellBox } from "@/components/market-sell-box";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

async function myListings(userId: string) {
  try {
    const res = await db().query(
      `SELECT l.id::text AS id, l.price::text AS price, i.code, i.species_id, i.level, i.enhance,
              s.name AS species_name, s.sprite_url
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       LEFT JOIN game_species s ON s.id = i.species_id
       WHERE l.seller_id = $1 AND l.status = 'open' ORDER BY l.created_at DESC`,
      [userId],
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10), price: Number.parseInt(r.price, 10),
      code: r.code, speciesId: r.species_id, level: r.level, enhance: r.enhance,
      name: r.species_name ?? r.species_id, spriteUrl: r.sprite_url ?? "",
    }));
  } catch { return []; }
}

/** Listing price vs the species' reference value (spec 6.29). */
function DealBadge({ price, reference }: { price: number; reference: number }) {
  if (!(reference > 0)) return null;
  const pct = ((price - reference) / reference) * 100;
  const txt = `${Math.abs(pct).toLocaleString("en-US", { maximumFractionDigits: 1 })}%`;
  if (pct <= -1) return <span className="deal good">▼ {txt} dưới giá thị trường</span>;
  if (pct >= 1) return <span className="deal bad">▲ {txt} trên giá thị trường</span>;
  return <span className="deal even">≈ giá thị trường</span>;
}

/**
 * Trading floor (spec 6.29) — the "Chợ thẻ" page, separate from the
 * "Thị trường" analytics page: open listings with deal badges, the
 * guided sell box, my open listings and my trade history.
 */
export default async function MeChoPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [listings, mine, history] = await Promise.all([
    openListings(60),
    myListings(session.userId),
    myMarketHistory(session.userId),
  ]);
  const day = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");

  return (
    <div className="player-body-inner">
      <h1>Chợ thẻ</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">Mua bán thẻ với người chơi khác — xem giá và xu hướng ở <Link href="/me/market">Thị trường</Link>.</p>

      <section className="player-panel">
        <h2>Đăng bán thẻ của tôi</h2>
        <MarketSellBox />
        {mine.length ? (
          <div style={{ marginTop: 10 }}>
            {mine.map((l) => (
              <div className="player-line" key={l.id}>
                <span><strong>{l.name}</strong> Lv.{l.level} +{l.enhance} · <code>{l.code}</code> · {fmt(l.price)} Coins</span>
                <form method="post" action="/api/me/market">
                  <input type="hidden" name="action" value="cancel" />
                  <input type="hidden" name="listingId" value={l.id} />
                  <button type="submit" className="player-btn sm ghost">Huỷ tin</button>
                </form>
              </div>
            ))}
          </div>
        ) : <p className="player-sub">Bạn chưa có tin bán nào đang mở.</p>}
      </section>

      <h2 className="player-h2">Tin đang bán — mua ngay</h2>
      <div className="tcg-grid">
        {listings.map((l) => {
          const own = l.sellerId === session.userId;
          return (
            <article className="tcg-card" key={l.id}>
              {l.spriteUrl ? <img src={l.spriteUrl} alt={l.speciesName} loading="lazy" /> : null}
              <div className="tcg-card-meta">
                <strong>{l.speciesName}</strong>
                <span>{RARITY_VI[l.rarity] ?? l.rarity} · Lv.{l.instance.level} +{l.instance.enhance}</span>
                <span className="tcg-price">{fmt(l.price)} Coins</span>
                <DealBadge price={l.price} reference={l.referenceValue} />
                <span className="tcg-num">Người bán {l.sellerId.slice(0, 8)}…</span>
                {own ? <span className="tcg-num">Tin của bạn</span> : (
                  <form method="post" action="/api/me/market">
                    <input type="hidden" name="action" value="buy" />
                    <input type="hidden" name="listingId" value={l.id} />
                    <button type="submit" className="player-btn sm">Mua</button>
                  </form>
                )}
              </div>
            </article>
          );
        })}
      </div>
      {listings.length === 0 ? <p className="player-notice">Chợ đang trống — hãy là người đăng bán đầu tiên.</p> : null}

      <div className="tcg-top2">
        <section className="tcg-panel">
          <h2>Lịch sử bán của tôi</h2>
          {history.sold.length ? history.sold.map((h) => (
            <div className="player-line" key={`s-${h.code}-${h.at}`}>
              <span><strong>{h.speciesName}</strong> · <code>{h.code}</code></span>
              <span>{fmt(h.price)} Coins · {day(h.at)}</span>
            </div>
          )) : <p className="tcg-empty">Bạn chưa bán được thẻ nào trên chợ.</p>}
        </section>
        <section className="tcg-panel">
          <h2>Lịch sử mua của tôi</h2>
          {history.bought.length ? history.bought.map((h) => (
            <div className="player-line" key={`b-${h.code}-${h.at}`}>
              <span><strong>{h.speciesName}</strong> · <code>{h.code}</code></span>
              <span>{fmt(h.price)} Coins · {day(h.at)}</span>
            </div>
          )) : <p className="tcg-empty">Bạn chưa mua thẻ nào trên chợ.</p>}
        </section>
      </div>
    </div>
  );
}
