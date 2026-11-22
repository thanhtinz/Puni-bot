import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { RARITY_VI } from "@/lib/tcg";
import CardArt from "@/components/card-art";
import TiltCard from "@/components/tilt-card";
import SlabCard, { gradeForRarity } from "@/components/slab-card";
import { shopSpeciesDetail } from "@/lib/shop";
import { getSellRatePercent } from "@/lib/player";
import { rulingsForSpecies } from "@/lib/rulings";
import { speciesMarketDetail } from "@/lib/tcg";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

function Change({ pct }: { pct: number | null }) {
  if (pct === null) return <span className="mk-dim">—</span>;
  const up = pct >= 0;
  return (
    <span className={up ? "trend up" : "trend down"}>
      {up ? "▲" : "▼"} {Math.abs(pct)}%
    </span>
  );
}

/** Price-history chart (optcg.app MARKET block): area + line over
 * the real internal price history, with range meta underneath. */
function PriceChart({ points }: { points: { t: string; price: number }[] }) {
  if (points.length < 2) {
    return <p className="player-sub">Chưa đủ dữ liệu để vẽ biểu đồ giá — biểu đồ hiện khi lá này có ít nhất 2 mốc giá trong khoảng đã chọn.</p>;
  }
  const w = 720, h = 180, pad = 10;
  const values = points.map((p) => p.price);
  const min = Math.min(...values), max = Math.max(...values);
  const range = max - min || 1;
  const xy = points.map((p, i) => {
    const x = pad + (i / (points.length - 1)) * (w - pad * 2);
    const y = h - pad - ((p.price - min) / range) * (h - pad * 2 - 14) - 4;
    return [x, y] as const;
  });
  const line = xy.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const area = `${pad},${h - 2} ${line} ${w - pad},${h - 2}`;
  const first = values[0], last = values[values.length - 1];
  const pct = first > 0 ? Math.round(((last - first) / first) * 1000) / 10 : null;
  const color = last >= first ? "#1d9e75" : "#d6455b";
  const [lx, ly] = xy[xy.length - 1];
  const dFmt = (iso: string) => new Date(iso).toLocaleDateString("vi-VN");
  return (
    <div className="mk-chart">
      <svg viewBox={`0 0 ${w} ${h}`} width="100%" role="img" aria-label="Biểu đồ lịch sử giá">
        <polygon points={area} fill={color} opacity="0.10" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="2.4" strokeLinejoin="round" />
        <circle cx={lx} cy={ly} r="4" fill={color} />
      </svg>
      <div className="mk-chart-meta">
        <span>{dFmt(points[0].t)} → {dFmt(points[points.length - 1].t)}</span>
        <span>Thấp nhất {fmt(min)}</span>
        <span>Cao nhất {fmt(max)}</span>
        <span>Hiện tại {fmt(last)} Coins</span>
        <Change pct={pct} />
      </div>
    </div>
  );
}

/**
 * Trang chi tiết một thẻ lẻ trong Shop (spec 6.36), kiểu trang sản
 * phẩm của sàn TCG: ảnh lớn (khung nhựa nếu thẻ hiếm), giá hệ thống,
 * tin người chơi đang bán ở Chợ và lịch sử giao dịch gần nhất.
 */
export default async function ShopSpeciesPage({
  params,
  searchParams,
}: {
  params: Promise<{ speciesId: string }>;
  searchParams: Promise<{ msg?: string; err?: string; range?: string }>;
}) {
  const session = (await currentSession())!;
  const { speciesId } = await params;
  const sp = await searchParams;
  const [detail, economy, sellRate, market] = await Promise.all([
    shopSpeciesDetail(speciesId, session.userId),
    getUserEconomy(session.userId).catch(() => null),
    getSellRatePercent().catch(() => 60),
    speciesMarketDetail(speciesId).catch(() => null),
  ]);
  const rangeDays = sp.range === "7" ? 7 : sp.range === "90" ? 90 : 30;
  const balance = economy?.balance ?? 0;

  if (!detail) {
    return (
      <div className="player-body-inner">
        <p className="player-notice err">Không tìm thấy thẻ này trong Shop.</p>
        <p><Link href="/me/shop">← Quay lại Shop</Link></p>
      </div>
    );
  }

  const grade = gradeForRarity(detail.rarity);
  const sellBack = Math.round(detail.price * sellRate) / 100;
  const rulings = await rulingsForSpecies(detail.speciesId, detail.setId).catch(() => []);

  return (
    <div className="player-body-inner">
      <p className="player-sub"><Link href="/me/shop">← Quay lại Shop</Link></p>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}

      <div className="shop-detail">
        <div className="shop-detail-art">
          <TiltCard holo={grade != null}>
            {grade ? (
              <SlabCard
                variant="shop"
                imageUrl={detail.spriteUrl}
                name={detail.name}
                setLine={detail.setName}
                grade={grade}
                cert={detail.speciesId.split("-").slice(0, 2).join("-").toUpperCase()}
              />
            ) : detail.rarity === "Rare" ? (
              <div className="toploader">
                <CardArt src={detail.spriteUrl} alt={detail.name} rarity={detail.rarity} />
              </div>
            ) : (
              <CardArt src={detail.spriteUrl} alt={detail.name} rarity={detail.rarity} />
            )}
          </TiltCard>
        </div>

        <div className="shop-detail-info">
          <h1 className="player-title">{detail.name}</h1>
          <p className="player-sub">
            {detail.gameName ? `${detail.gameName} · ` : ""}{detail.setName} · {RARITY_VI[detail.rarity] ?? detail.rarity}
            {detail.memberExclusive ? " · Độc quyền hội viên" : ""}
          </p>
          {detail.baseHp != null || detail.baseAtk != null ? (
            <p className="shop-stats">
              {detail.baseHp != null ? <span>HP {detail.baseHp}</span> : null}
              {detail.baseAtk != null ? <span>ATK {detail.baseAtk}</span> : null}
            </p>
          ) : null}

          <div className="shop-price-box">
            <div>
              <span className="shop-price-label">Giá Shop</span>
              <strong className="shop-price-value">{fmt(detail.price)} Coins</strong>
            </div>
            <p className="player-sub">
              Bán lại cho hệ thống: {fmt(sellBack)} Coins ({sellRate}%)
              {detail.priceUsd != null ? ` · Giá thị trường tham khảo $${detail.priceUsd.toLocaleString("en-US", { maximumFractionDigits: 2 })}` : ""}
            </p>
            <p className="player-sub">Bạn đang có {detail.owned} lá này</p>
            <form method="post" action="/api/me/shop">
              <input type="hidden" name="kind" value="card-single" />
              <input type="hidden" name="species" value={detail.speciesId} />
              <input type="hidden" name="back" value={`/me/shop/${detail.speciesId}`} />
              <button type="submit" className="player-btn" disabled={balance < detail.price}>
                Mua ngay · {fmt(detail.price)} Coins
              </button>
            </form>
          </div>

          {market ? (
            <section className="gacha-block">
              <h2>Thị trường</h2>
              <div className="mk-detail-stats">
                <div><span>Giá nội bộ</span><strong>{market.marketPrice !== null ? `${fmt(market.marketPrice)} Coins` : "—"}</strong></div>
                <div><span>Giá sàn Chợ</span><strong>{market.floorPrice !== null ? `${fmt(market.floorPrice)} Coins` : "—"}</strong></div>
                <div><span>Bán gần nhất</span><strong>{market.lastSold !== null ? `${fmt(market.lastSold)} Coins` : "—"}</strong></div>
                <div>
                  <span>TB đã bán · xu hướng 7 ngày</span>
                  <strong>{market.avgSold !== null ? `${fmt(market.avgSold)} Coins` : "—"} <Change pct={market.trendPct} /></strong>
                </div>
              </div>
              <div className="mk-range">
                {([7, 30, 90] as const).map((d) => (
                  <Link
                    key={d}
                    href={`/me/shop/${detail.speciesId}?range=${d}`}
                    className={rangeDays === d ? "on" : ""}
                  >
                    {d === 7 ? "7 ngày" : d === 30 ? "1 tháng" : "3 tháng"}
                  </Link>
                ))}
              </div>
              <PriceChart
                points={(market.history.length >= 2 ? market.history : market.dailySales).filter(
                  (p) => Date.now() - new Date(p.t).getTime() <= rangeDays * 24 * 3600 * 1000,
                )}
              />
            </section>
          ) : null}

          {rulings.length ? (
            <section className="gacha-block">
              <h2>Rulings — phán quyết chính thức</h2>
              <ul className="ruling-list">
                {rulings.map((r) => (
                  <li key={r.id}>
                    <strong>{r.title}</strong>
                    <span className="ruling-scope">
                      {r.scope === "species" ? "Ruling của lá này" : r.scope === "set" ? "Ruling của bộ" : "Ruling của game"}
                    </span>
                    <p>{r.bodyVi || r.body}</p>
                    {r.bodyVi ? <p className="ruling-orig">Bản gốc tiếng Anh: {r.body}</p> : null}
                    {r.source ? <p className="player-sub">Nguồn: {r.source}</p> : null}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <section className="gacha-block">
            <h2>Người chơi đang bán</h2>
            {detail.listings.length === 0 ? (
              <p className="player-sub">Chưa có ai rao bán lá này ở Chợ Thẻ.</p>
            ) : (
              <>
                <ul className="shop-sales">
                  {detail.listings.map((l) => (
                    <li key={l.id}>
                      <span>{fmt(l.price)} Coins</span>
                      <span className="player-sub">người bán #{l.sellerId.slice(0, 6)}</span>
                    </li>
                  ))}
                </ul>
                <p><Link href="/me/cho">Tới Chợ Thẻ để mua từ người chơi →</Link></p>
              </>
            )}
          </section>

          <section className="gacha-block">
            <h2>Giao dịch gần nhất ở Chợ</h2>
            {detail.sales.length === 0 ? (
              <p className="player-sub">Chưa có giao dịch nào của lá này.</p>
            ) : (
              <ul className="shop-sales">
                {detail.sales.map((s, i) => (
                  <li key={i}>
                    <span>{fmt(s.price)} Coins</span>
                    <span className="player-sub">{new Date(s.soldAt).toLocaleDateString("vi-VN")}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
