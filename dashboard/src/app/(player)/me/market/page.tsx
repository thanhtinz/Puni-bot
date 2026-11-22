import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { marketIndexSeries, marketOverview, marketSummary, RARITY_VI } from "@/lib/tcg";
import { listGameSets } from "@/lib/db";
import { IconActivity, IconBag, IconChart, IconCoins, IconGrid, IconList, IconSpark } from "@/components/icons";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });
const PAGE_SIZE = 24;

function TrendBadge({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="mk-dim">—</span>;
  const up = pct >= 0;
  return (
    <span className={up ? "trend up" : "trend down"}>
      {up ? "▲" : "▼"} {Math.abs(pct).toLocaleString("en-US", { maximumFractionDigits: 4 })}%
    </span>
  );
}

function Sparkline({ data, w = 96, h = 28 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return <span className="mk-dim">—</span>;
  const pad = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const range = max - min || 1;
  const pts = data.map((v, i) => {
    const x = pad + (i / (data.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  const rising = data[data.length - 1] >= data[0];
  return (
    <svg className="mk-spark" width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true">
      <polyline points={pts} fill="none" stroke={rising ? "#1d9e75" : "#d6455b"} strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

/** Big market index chart (30 days) with area fill and end labels. */
function IndexChart({ points, changePct }: { points: number[]; changePct: number | null }) {
  if (points.length < 2) {
    return <p className="tcg-empty">Chưa đủ giao dịch để vẽ đường chỉ số — đường giá sẽ hiện khi chợ có giao dịch ở ít nhất 2 ngày khác nhau.</p>;
  }
  const w = 720, h = 170, pad = 10;
  const min = Math.min(...points), max = Math.max(...points);
  const range = max - min || 1;
  const xy = points.map((v, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((v - min) / range) * (h - pad * 2 - 14) - 4;
    return [x, y] as const;
  });
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${h - 2} ${line} ${w - pad},${h - 2}`;
  const rising = points[points.length - 1] >= points[0];
  const color = rising ? "#1d9e75" : "#d6455b";
  const [lx, ly] = xy[xy.length - 1];
  return (
    <div className="mk-chart">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Đường chỉ số giá thị trường 30 ngày">
        <polygon points={area} fill={color} opacity="0.10" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx={lx} cy={ly} r="4" fill={color} />
      </svg>
      <div className="mk-chart-meta">
        <span>Thấp nhất {fmt(min)} điểm</span>
        <span>Cao nhất {fmt(max)} điểm</span>
        <span>Chỉ số hiện tại {fmt(points[points.length - 1])} điểm</span>
        {changePct !== null ? <TrendBadge pct={changePct} /> : null}
      </div>
    </div>
  );
}

function StatCard({ icon, num, cap, sub }: { icon: React.ReactNode; num: React.ReactNode; cap: string; sub?: string }) {
  return (
    <div className="mk-stat">
      <span className="mk-stat-ico">{icon}</span>
      <span className="mk-stat-num">{num}</span>
      <span className="mk-stat-cap">{cap}{sub ? <><br />{sub}</> : null}</span>
    </div>
  );
}

/**
 * Market analytics (spec 6.29) — the "Thị trường" page, separate from
 * the "Chợ thẻ" trading page: headline statistics with icons, the
 * 30-day market index line, movers with their own price lines, and
 * the per-species data table. Every number comes from real
 * tcg_listings / tcg_price_history rows.
 */
export default async function MeMarketPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; rarity?: string; set?: string; sort?: string; page?: string }>;
}) {
  await currentSession();
  const sp = await searchParams;
  const [all, summary, sets, index] = await Promise.all([
    marketOverview(),
    marketSummary(),
    listGameSets().catch(() => []),
    marketIndexSeries(),
  ]);
  const setName = new Map(sets.map((s) => [s.id, s.name]));

  const gainers = all.filter((c) => c.trendPct !== null && c.trendPct > 0).sort((a, b) => (b.trendPct ?? 0) - (a.trendPct ?? 0)).slice(0, 5);
  const losers = all.filter((c) => c.trendPct !== null && c.trendPct < 0).sort((a, b) => (a.trendPct ?? 0) - (b.trendPct ?? 0)).slice(0, 5);
  const bestSellers = [...all].filter((c) => c.soldCount > 0).sort((a, b) => b.soldCount - a.soldCount).slice(0, 5);
  const topValue = [...all].sort((a, b) => (b.floorPrice ?? b.referenceValue) - (a.floorPrice ?? a.referenceValue)).slice(0, 5);

  const q = (sp.q ?? "").toLowerCase();
  let rows = all.filter(
    (c) =>
      (!q || c.name.toLowerCase().includes(q) || c.speciesId.includes(q)) &&
      (!sp.rarity || c.rarity === sp.rarity) &&
      (!sp.set || c.set === sp.set),
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
    const p = new URLSearchParams({ q: sp.q ?? "", rarity: sp.rarity ?? "", set: sp.set ?? "", sort, page: String(page) });
    for (const [k, v] of Object.entries(patch)) p.set(k, v);
    return `/me/market?${p.toString()}`;
  };

  return (
    <div className="player-body-inner">
      <h1>Thị trường thẻ</h1>
      <p className="player-sub">Số liệu và xu hướng giá của chợ — mua bán ở <Link href="/me/cho">Chợ thẻ</Link>.</p>

      <div className="mk-stats">
        <StatCard icon={<IconCoins size={17} />} num={`${fmt(summary.openValue)} Coins`} cap="Tổng giá trị tin đang bán" />
        <StatCard icon={<IconList size={17} />} num={fmt(summary.openListings)} cap="Tin đang mở" />
        <StatCard icon={<IconBag size={17} />} num={fmt(summary.soldCount)} cap="Lượt đã bán thành công" sub={`Tổng khối lượng ${fmt(summary.volumeAll)} Coins`} />
        <StatCard icon={<IconActivity size={17} />} num={`${fmt(summary.volume7d)} Coins`} cap="Khối lượng giao dịch 7 ngày" sub={`${fmt(summary.trades7d)} giao dịch`} />
        <StatCard icon={<IconGrid size={17} />} num={fmt(summary.speciesListed)} cap="Mẫu thẻ đang có tin bán" sub={`${fmt(summary.speciesTraded)} mẫu đã từng giao dịch`} />
        <StatCard icon={<IconChart size={17} />} num={fmt(summary.internalPriced)} cap="Mẫu đã có giá nội bộ" sub="Giá do chợ quyết định" />
        <StatCard icon={<IconSpark size={17} />} num={summary.topSale ? `${fmt(summary.topSale.price)} Coins` : "—"} cap="Giá bán cao nhất" sub={summary.topSale?.speciesName} />
        <StatCard icon={<IconActivity size={17} />} num={<TrendBadge pct={summary.indexChangePct} />} cap="Chỉ số giá bán TB" sub="7 ngày so với 7 ngày trước" />
      </div>

      <section className="player-panel">
        <h2 className="mk-h2"><IconChart size={18} /> Chỉ số giá thị trường — 30 ngày</h2>
        <IndexChart points={index.points} changePct={index.changePct} />
      </section>

      <div className="tcg-top2">
        <section className="tcg-panel">
          <h2>{gainers.length ? "Top tăng giá (7 ngày)" : "Top thẻ giá trị cao nhất"}</h2>
          {(gainers.length ? gainers : topValue).map((c) => (
            <div className="tcg-row" key={c.speciesId}>
              {c.spriteUrl ? <img src={c.spriteUrl} alt={c.name} loading="lazy" /> : null}
              <div className="tcg-row-main">
                <strong>{c.name}</strong>
                <span>
                  {c.floorPrice ? `Sàn ${fmt(c.floorPrice)}` : `Tham khảo ${fmt(c.referenceValue)}`} Coins
                  {c.lastSold ? ` · Bán gần nhất ${fmt(c.lastSold)}` : ""}
                </span>
              </div>
              <Sparkline data={c.spark} w={64} h={20} />
              {gainers.length ? <TrendBadge pct={c.trendPct} /> : <span className="tcg-badge">{RARITY_VI[c.rarity] ?? c.rarity}</span>}
            </div>
          ))}
          {all.length === 0 ? <p className="tcg-empty">Chưa có mẫu thẻ nào có hoạt động chợ.</p> : null}
        </section>
        <section className="tcg-panel">
          <h2>{losers.length ? "Top giảm giá (7 ngày)" : "Bán chạy nhất"}</h2>
          {(losers.length ? losers : bestSellers).length ? (losers.length ? losers : bestSellers).map((c) => (
            <div className="tcg-row" key={c.speciesId}>
              {c.spriteUrl ? <img src={c.spriteUrl} alt={c.name} loading="lazy" /> : null}
              <div className="tcg-row-main">
                <strong>{c.name}</strong>
                <span>Đã bán {c.soldCount} lượt{c.avgSold ? ` · TB ${fmt(c.avgSold)} Coins` : ""}</span>
              </div>
              <Sparkline data={c.spark} w={64} h={20} />
              {losers.length ? <TrendBadge pct={c.trendPct} /> : <span className="tcg-badge">{RARITY_VI[c.rarity] ?? c.rarity}</span>}
            </div>
          )) : <p className="tcg-empty">Chưa có giao dịch nào hoàn tất — lịch sử bán sẽ hiện ở đây.</p>}
        </section>
      </div>

      <form className="tcg-filters" method="get">
        <label>
          Tìm thẻ
          <input type="search" name="q" defaultValue={sp.q ?? ""} placeholder="Tên thẻ..." />
        </label>
        <label>
          Bộ thẻ
          <select name="set" defaultValue={sp.set ?? ""}>
            <option value="">Tất cả bộ</option>
            {sets.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
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

      <div className="mk-table-wrap">
        <table className="mk-table">
          <thead>
            <tr>
              <th>Thẻ</th>
              <th>Độ hiếm</th>
              <th className="num">Giá sàn</th>
              <th className="num">Tham chiếu</th>
              <th className="num">Bán gần nhất</th>
              <th className="num">TB đã bán</th>
              <th className="num">7 ngày</th>
              <th className="num">Tin / Đã bán</th>
              <th>Đường giá</th>
            </tr>
          </thead>
          <tbody>
            {pageRows.map((c) => (
              <tr key={c.speciesId}>
                <td>
                  <span className="mk-card-cell">
                    {c.spriteUrl ? <img src={c.spriteUrl} alt={c.name} loading="lazy" /> : null}
                    <span>
                      <strong>{c.name}</strong>
                      <small>{setName.get(c.set) ?? c.set} · HP {c.hp} · ATK {c.atk}</small>
                    </span>
                  </span>
                </td>
                <td>{RARITY_VI[c.rarity] ?? c.rarity}</td>
                <td className="num">{c.floorPrice ? `${fmt(c.floorPrice)}` : <span className="mk-dim">{fmt(c.referenceValue)}*</span>}</td>
                <td className="num">
                  {fmt(c.referenceValue)}
                  {c.marketPrice !== null ? <span className="mk-ref-tag">nội bộ</span> : null}
                </td>
                <td className="num">{c.lastSold ? fmt(c.lastSold) : "—"}</td>
                <td className="num">{c.avgSold ? fmt(c.avgSold) : "—"}</td>
                <td className="num"><TrendBadge pct={c.trendPct} /></td>
                <td className="num">{c.listings} / {c.soldCount}</td>
                <td><Sparkline data={c.spark} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="player-sub">* Chưa có tin bán — hiện giá tham chiếu. Nhãn “nội bộ” = giá do giao dịch trên chợ quyết định.</p>
      {rows.length === 0 ? <p className="tcg-empty">Không có mẫu thẻ nào khớp bộ lọc (bảng chỉ liệt kê mẫu đã có hoạt động chợ).</p> : null}
      <nav className="tcg-pager">
        {page > 1 ? <Link href={qs({ page: String(page - 1) })}>← Trang trước</Link> : <span />}
        <span>Trang {page}/{totalPages} · {rows.length} thẻ</span>
        {page < totalPages ? <Link href={qs({ page: String(page + 1) })}>Trang sau →</Link> : <span />}
      </nav>
    </div>
  );
}
