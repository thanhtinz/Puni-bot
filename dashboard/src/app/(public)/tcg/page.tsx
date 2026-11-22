import Link from "next/link";
import { marketOverview, RARITY_VI } from "@/lib/tcg";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;
const fmt = (n: number) => n.toLocaleString("vi-VN");

export default async function TcgMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rarity?: string; sort?: string; page?: string }>;
}) {
  const sp = await searchParams;
  const all = await marketOverview();
  const q = (sp.q ?? "").toLowerCase();
  let rows = all.filter(
    (c) =>
      (!q || c.name.toLowerCase().includes(q) || c.slug.includes(q)) &&
      (!sp.rarity || c.rarity === sp.rarity),
  );
  const sort = sp.sort ?? "value-desc";
  rows = [...rows].sort((a, b) => {
    const pa = a.floorPrice ?? a.referenceValue;
    const pb = b.floorPrice ?? b.referenceValue;
    if (sort === "price-asc") return pa - pb;
    if (sort === "name") return a.name.localeCompare(b.name);
    return pb - pa;
  });
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const totalPages = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const pageRows = rows.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const topValue = [...all].sort((a, b) => b.referenceValue - a.referenceValue).slice(0, 5);
  const topListed = [...all].filter((c) => c.listings > 0).sort((a, b) => b.listings - a.listings).slice(0, 5);
  const openCount = all.reduce((s, c) => s + c.listings, 0);

  const qs = (patch: Record<string, string>) => {
    const p = new URLSearchParams({ q: sp.q ?? "", rarity: sp.rarity ?? "", sort, page: String(page) });
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    return `/tcg?${p.toString()}`;
  };

  return (
    <div className="tcg-body">
      <div className="tcg-head">
        <h1>Thị trường thẻ Puni × Tuxemon</h1>
        <p>{all.length} mẫu thẻ · {openCount} tin đang bán trên chợ · Giá hiển thị là giá sàn chợ, chưa có tin bán thì là giá trị tham khảo. Mua bán diễn ra trong Discord bằng lệnh <code>market</code>.</p>
      </div>

      <div className="tcg-top2">
        <section className="tcg-panel">
          <h2>Top 5 thẻ giá trị cao nhất</h2>
          {topValue.map((c) => (
            <div className="tcg-row" key={c.slug}>
              <img src={`/cards/${c.slug}.png`} alt={c.name} loading="lazy" />
              <div className="tcg-row-main">
                <strong>{c.name}</strong>
                <span>{RARITY_VI[c.rarity] ?? c.rarity} · {fmt(c.referenceValue)} Coins</span>
              </div>
              <span className="tcg-badge">{c.number}</span>
            </div>
          ))}
        </section>
        <section className="tcg-panel">
          <h2>Đang bán nhiều nhất</h2>
          {topListed.length ? topListed.map((c) => (
            <div className="tcg-row" key={c.slug}>
              <img src={`/cards/${c.slug}.png`} alt={c.name} loading="lazy" />
              <div className="tcg-row-main">
                <strong>{c.name}</strong>
                <span>{c.listings} tin · sàn {c.floorPrice ? fmt(c.floorPrice) : "—"} Coins</span>
              </div>
              <span className="tcg-badge">{RARITY_VI[c.rarity] ?? c.rarity}</span>
            </div>
          )) : <p className="tcg-empty">Chợ chưa có tin bán nào — người chơi đăng bán trong Discord bằng lệnh <code>market sell</code>.</p>}
        </section>
      </div>

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
                {c.floorPrice ? <>Sàn chợ: {fmt(c.floorPrice)} Coins</> : <>Tham khảo: {fmt(c.referenceValue)} Coins</>}
                {c.listings > 0 ? ` · ${c.listings} tin` : ""}
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
    </div>
  );
}
