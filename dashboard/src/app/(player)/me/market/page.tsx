import { currentSession } from "@/lib/current-session";
import { cardInfo, openListings, RARITY_VI } from "@/lib/tcg";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("vi-VN");

async function myListings(userId: string) {
  try {
    const res = await db().query(
      `SELECT l.id::text AS id, l.price::text AS price, i.code, i.species_id, i.level, i.enhance
       FROM tcg_listings l JOIN tcg_instances i ON i.code = l.instance_code
       WHERE l.seller_id = $1 AND l.status = 'open' ORDER BY l.created_at DESC`,
      [userId],
    );
    return res.rows.map((r) => ({
      id: Number.parseInt(r.id, 10), price: Number.parseInt(r.price, 10),
      code: r.code, speciesId: r.species_id, level: r.level, enhance: r.enhance,
    }));
  } catch { return []; }
}

export default async function MeMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [listings, mine] = await Promise.all([openListings(60), myListings(session.userId)]);
  return (
    <div className="player-body-inner">
      <h1>Chợ thẻ</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <section className="player-panel">
        <h2>Đăng bán thẻ</h2>
        <form method="post" action="/api/me/market" className="player-inline-form">
          <input type="hidden" name="action" value="sell" />
          <input type="text" name="code" placeholder="Mã thẻ 8 ký tự" maxLength={8} required />
          <input type="number" name="price" placeholder="Giá Coins (từ 10)" min={10} required />
          <button type="submit" className="player-btn">Đăng bán (phí 5% khi bán được)</button>
        </form>
      </section>
      <section className="player-panel">
        <h2>Tin bán của tôi ({mine.length})</h2>
        {mine.length === 0 ? <p className="player-sub">Chưa có tin nào đang mở.</p> : mine.map((l) => (
          <div className="player-line" key={l.id}>
            <span><strong>{cardInfo(l.speciesId)?.name ?? l.speciesId}</strong> Lv.{l.level} +{l.enhance} · <code>{l.code}</code> · {fmt(l.price)} Coins</span>
            <form method="post" action="/api/me/market">
              <input type="hidden" name="action" value="cancel" />
              <input type="hidden" name="listingId" value={l.id} />
              <button type="submit" className="player-btn sm ghost">Huỷ tin</button>
            </form>
          </div>
        ))}
      </section>
      <h2 className="player-h2">Đang bán trên chợ</h2>
      <div className="tcg-grid">
        {listings.map((l) => {
          const info = cardInfo(l.instance.speciesId);
          const own = l.sellerId === session.userId;
          return (
            <article className="tcg-card" key={l.id}>
              <img src={`/cards/${l.instance.speciesId}.png`} alt={info?.name ?? l.instance.speciesId} loading="lazy" />
              <div className="tcg-card-meta">
                <strong>{info?.name ?? l.instance.speciesId}</strong>
                <span>{RARITY_VI[info?.rarity ?? "Common"]} · Lv.{l.instance.level} +{l.instance.enhance}</span>
                <span className="tcg-price">{fmt(l.price)} Coins</span>
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
      {listings.length === 0 ? <p className="player-notice">Chợ đang trống.</p> : null}
    </div>
  );
}
