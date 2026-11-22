import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { userWallet, RARITY_VI } from "@/lib/tcg";
import CardArt from "@/components/card-art";
import { featuredCards, SHOP_PACK_PRICES } from "@/lib/shop";
import { getSellRatePercent } from "@/lib/player";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Shop bán thẻ của hệ thống (spec 6.24): mua gói thẻ bằng Coins và
 * mua thẻ lẻ nổi bật luân phiên theo ngày. Giá do server tính lại
 * lúc mua; kệ hàng đổi vào 00:00 UTC mỗi ngày.
 */
export default async function MeShopPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [economy, wallet, shelf, sellRate] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    userWallet(session.userId),
    featuredCards(),
    getSellRatePercent().catch(() => 60),
  ]);
  const balance = economy?.balance ?? 0;

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Shop thẻ</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">
        Số dư {fmt(balance)} Coins · Gói Thường đang có: {wallet.packsStandard} · Gói Cao Cấp: {wallet.packsPremium}
      </p>

      <section className="gacha-block">
        <h2>Mua gói thẻ</h2>
        <p className="player-sub">
          Mỗi gói có 5 thẻ, mở ở trang Mở Thẻ. Gói Cao Cấp đảm bảo lá cuối ít nhất Sử thi.
        </p>
        <div className="gacha-actions">
          <form method="post" action="/api/me/shop">
            <input type="hidden" name="kind" value="pack-standard" />
            <button type="submit" className="player-btn" disabled={balance < SHOP_PACK_PRICES.standard}>
              Gói Thường · {fmt(SHOP_PACK_PRICES.standard)} Coins
            </button>
          </form>
          <form method="post" action="/api/me/shop">
            <input type="hidden" name="kind" value="pack-premium" />
            <button type="submit" className="player-btn" disabled={balance < SHOP_PACK_PRICES.premium}>
              Gói Cao Cấp · {fmt(SHOP_PACK_PRICES.premium)} Coins
            </button>
          </form>
        </div>
      </section>

      <section className="gacha-block">
        <h2>Thẻ nổi bật hôm nay</h2>
        <p className="player-sub">
          Kệ hàng thay mới mỗi ngày lúc 00:00 UTC. Giá bằng giá trị hệ thống của thẻ ở cấp 1 —
          bán lại cho hệ thống được {sellRate}% giá trị.
        </p>
        <div className="tcg-grid">
          {shelf.map((f) => {
            return (
              <article className={`tcg-card rarity-${f.rarity.toLowerCase()}`} key={f.speciesId}>
                <CardArt src={f.spriteUrl} alt={f.name} rarity={f.rarity} />
                <h3>{f.name}</h3>
                <p className="player-sub">
                  {RARITY_VI[f.rarity] ?? f.rarity}
                  {f.memberExclusive ? " · Độc quyền hội viên" : ""}
                </p>
                <form method="post" action="/api/me/shop">
                  <input type="hidden" name="kind" value="card" />
                  <input type="hidden" name="species" value={f.speciesId} />
                  <button type="submit" className="player-btn" disabled={balance < f.price}>
                    Mua · {fmt(f.price)} Coins
                  </button>
                </form>
              </article>
            );
          })}
        </div>
      </section>
    </div>
  );
}
