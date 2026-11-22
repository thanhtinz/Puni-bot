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

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

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
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const { speciesId } = await params;
  const sp = await searchParams;
  const [detail, economy, sellRate] = await Promise.all([
    shopSpeciesDetail(speciesId, session.userId),
    getUserEconomy(session.userId).catch(() => null),
    getSellRatePercent().catch(() => 60),
  ]);
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
            <p className="player-sub">Bạn đang có {detail.owned} lá này · Số dư {fmt(balance)} Coins</p>
            <form method="post" action="/api/me/shop">
              <input type="hidden" name="kind" value="card-single" />
              <input type="hidden" name="species" value={detail.speciesId} />
              <input type="hidden" name="back" value={`/me/shop/${detail.speciesId}`} />
              <button type="submit" className="player-btn" disabled={balance < detail.price}>
                Mua ngay · {fmt(detail.price)} Coins
              </button>
            </form>
          </div>

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
                    <p>{r.body}</p>
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
