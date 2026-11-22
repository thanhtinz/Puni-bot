import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { cardInfo, marketOverview, openListings, RARITY_VI } from "@/lib/tcg";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("vi-VN");
const PAGE_SIZE = 24;

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

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return null;
  const up = pct >= 0;
  return (
    <span className={up ? "trend up" : "trend down"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toLocaleString("vi-VN")}%
    </span>
  );
}

export default async function MeMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rarity?: string; sort?: string; page?: string; msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [all, listings, mine] = await Promise.all([
    marketOverview(),
    openListings(60),
    myListings(session.userId),
  ]);

  const totalOpen = all.reduce((s, c) => s + c.listings, 0);
  const totalSold = all.reduce((s, c) => s + c.soldCount, 0);
  const gainers = all.filter((c) => c.trendPct !== null && c.trendPct > 0).sort((a, b) => (b.trendPct ?? 0) - (a.trendPct ?? 0)).slice(0, 5);
  const losers = all.filter((c) => c.trendPct !== null && c.trendPct < 0).sort((a, b) => (a.trendPct ?? 0) - (b.trendPct ?? 0)).slice(0, 5);
  const bestSellers = [...all].filter((c) => c.soldCount > 0).sort((a, b) => b.soldCount - a.soldCount).slice(0, 5);
  const topValue = [...all].sort((a, b) => (b.floorPrice ?? b.referenceValue) - (a.floorPrice ?? a.referenceValue)).slice(0, 5);

  const q = (sp.q ?? "").toLowerCase();
  let rows = all.filter(
    (c) => (!q || c.name.toLowerCase().includes(q) || c.slug.includes(q)) && (!sp.rarity || c.rarity === sp.rarity),
  );
  const sort = sp.sort ?? "value-desc";
  rows = [...rows].sort((a, b) => {
    const pa = a.floorPrice ?? a.referenceValue;
    const pb = b.floorPrice ?? b.referenceValue;
    if (sort === "price-asc") return pa - pb;
    if (sort === "name") return a.name.localeCompare(b.name);
    if (sort === "sold") return b.soldCount - a.soldCount;
    return pb - pa;
  });
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ q: sp.q ?? "", rarity: sp.rarity ?? "", sort, page: String(page) });
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    return `/me/market?${p.toString()}`;
  };

  return (
    <div className="player-body-inner">
      <h1>Thị trường thẻ</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">
        {all.length} mẫu thẻ · {totalOpen} tin đang bán · {totalSold} lượt đã bán thành công.
        Giá sàn là giá bán thấp nhất đang mở; giá bán gần nhất và xu hướng tính từ giao dịch thật trên chợ (7 ngày so với 7 ngày trước).
      </p>

      <div className="tcg-top2">
        <section className="tcg-panel">
          <h2>{gainers.length ? "Top tăng giá (7 ngày)" : "Top thẻ giá trị cao nhất"}</h2>
          {(gainers.length ? gainers : topValue).map((c) => (
            <div className="tcg-row" key={c.slug}>
              <img src={`/cards/${c.slug}.png`} alt={c.name} loading="lazy" />
              <div className="tcg-row-main">
                <strong>{c.name}</strong>
                <span>
                  {c.floorPrice ? `Sàn ${fmt(c.floorPrice)}` : `Tham khảo ${fmt(c.referenceValue)}`} Coins
                  {c.lastSold ? ` · Bán gần nhất ${fmt(c.lastSold)}` : ""}
                </span>
              </div>
              {gainers.length ? <TrendBadge pct={c.trendPct} /> : <span className="tcg-badge">{c.number}</span>}
            </div>
          ))}
        </section>
        <section className="tcg-panel">
          <h2>{losers.length ? "Top giảm giá (7 ngày)" : "Bán chạy nhất"}</h2>
          {(losers.length ? losers : bestSellers).length ? (losers.length ? losers : bestSellers).map((c) => (
            <div className="tcg-row" key={c.slug}>
              <img src={`/cards/${c.slug}.png`} alt={c.name} loading="lazy" />
              <div className="tcg-row-main">
                <strong>{c.name}</strong>
                <span>Đã bán {c.soldCount} lượt{c.avgSold ? ` · TB ${fmt(c.avgSold)} Coins` : ""}</span>
              </div>
              {losers.length ? <TrendBadge pct={c.trendPct} /> : <span className="tcg-badge">{RARITY_VI[c.rarity] ?? c.rarity}</span>}
            </div>
          )) : <p className="tcg-empty">Chưa có giao dịch nào hoàn tất — lịch sử bán sẽ hiện ở đây.</p>}
        </section>
      </div>

      <section className="player-panel">
        <h2>Đăng bán thẻ của tôi</h2>
        <form method="post" action="/api/me/market" className="player-inline-form">
          <input type="hidden" name="action" value="sell" />
          <input type="text" name="code" placeholder="Mã thẻ 8 ký tự" maxLength={8} required />
          <input type="number" name="price" placeholder="Giá Coins (từ 10)" min={10} required />
          <button type="submit" className="player-btn">Đăng bán (phí 5% khi bán được)</button>
        </form>
        {mine.length ? (
          <div style={{ marginTop: 10 }}>
            {mine.map((l) => (
              <div className="player-line" key={l.id}>
                <span><strong>{cardInfo(l.speciesId)?.name ?? l.speciesId}</strong> Lv.{l.level} +{l.enhance} · <code>{l.code}</code> · {fmt(l.price)} Coins</span>
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

      <form className="tcg-filters" method="get">
        <label>
          Tìm thẻ
          <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Tên thẻ..." />
        </label>
        <label>
          Độ hiếm
          <select name="rarity" defaultValue={sp.rarity ?? ""}>
            <option value="">Tất cả độ hiếm</option>
            {Object.entries(RARITY_VI).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>
        </label>
        <label>
          Sắp xếp
          <select name="sort" defaultValue={sort}>
            <option value="value-desc">Giá cao nhất</option>
            <option value="price-asc">Giá thấp nhất</option>
            <option value="sold">Bán chạy nhất</option>
            <option value="name">Tên A–Z</option>
          </select>
        </label>
        <button type="submit" className="tcg-btn">Lọc</button>
      </form>

      <div className="tcg-grid">
        {pageRows.map((c) => (
          <article className="tcg-card" key={c.slug}>
            <img src={`/cards/${c.slug}.png`} alt={c.name} loading="lazy" />
            <div className="tcg-card-meta">
              <strong>{c.name}</strong>
              <span>{RARITY_VI[c.rarity] ?? c.rarity} · Hệ {c.types} · HP {c.hp}</span>
              <span className="tcg-price">
                {c.floorPrice ? <>Sàn: {fmt(c.floorPrice)} Coins</> : <>Tham khảo: {fmt(c.referenceValue)} Coins</>}
              </span>
              <span>
                {c.lastSold ? <>Bán gần nhất: {fmt(c.lastSold)}</> : "Chưa có giao dịch"}
                {c.listings > 0 ? ` · ${c.listings} tin` : ""} <TrendBadge pct={c.trendPct} />
              </span>
              <span className="tcg-num">N°{c.number}</span>
            </div>
          </article>
        ))}
      </div>
      {rows.length === 0 ? <p className="tcg-empty">Không có thẻ nào khớp bộ lọc.</p> : null}
      <nav className="tcg-pager">
        {page > 1 ? <Link href={qs({ page: String(page - 1) })}>← Trang trước</Link> : <span />}
        <span>Trang {page}/{totalPages} · {rows.length} thẻ</span>
        {page < totalPages ? <Link href={qs({ page: String(page + 1) })}>Trang sau →</Link> : <span />}
      </nav>

      <h2 className="player-h2">Tin đang bán — mua ngay</h2>
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
      {listings.length === 0 ? <p className="player-notice">Chợ đang trống — hãy là người đăng bán đầu tiên.</p> : null}
    </div>
  );
}
