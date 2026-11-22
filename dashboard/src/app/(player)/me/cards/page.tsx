import { currentSession } from "@/lib/current-session";
import { userInstances, userWallet, RARITY_VI } from "@/lib/tcg";
import { cardValue, getPriceCoinsPerUsd, getSellRatePercent, snapMoney } from "@/lib/player";
import CardArt from "@/components/card-art";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

export default async function MeCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [instances, wallet, rate, priceRate] = await Promise.all([
    userInstances(session.userId),
    userWallet(session.userId),
    getSellRatePercent(),
    getPriceCoinsPerUsd(),
  ]);
  const valueOf = (i: (typeof instances)[number]) =>
    cardValue(i.rarity, i.level, i.enhance, i.priceUsd, priceRate, i.marketPriceCoins);
  const totalValue = instances.reduce((s, i) => s + valueOf(i), 0);
  return (
    <div className="player-body-inner">
      <h1>Kho thẻ của {session.username}</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">{instances.length} lá · Tổng giá trị {fmt(totalValue)} Coins · {fmt(wallet.shards)} Mảnh thẻ · Gói: {wallet.packsStandard} thường / {wallet.packsPremium} cao cấp · Hệ thống mua lại {rate}% giá trị (nút Bán).</p>
      {instances.length === 0 ? (
        <p className="player-notice">Chưa có thẻ nào — vào Discord dùng lệnh <code>gacha single</code> để mở lá đầu tiên.</p>
      ) : (
        <div className="tcg-grid">
          {instances.map((inst) => {
            const value = valueOf(inst);
            const sellPrice = snapMoney((value * rate) / 100);
            return (
              <article className="tcg-card" key={inst.code}>
                <CardArt src={inst.spriteUrl} alt={inst.name} rarity={inst.rarity} />
                <div className="tcg-card-meta">
                  <strong>{inst.name}</strong>
                  <span>{RARITY_VI[inst.rarity] ?? inst.rarity} · Lv.{inst.level} +{inst.enhance} · <code>{inst.code}</code></span>
                  <span className="tcg-price">Giá trị {fmt(value)} Coins</span>
                  <span className="tcg-price-sub">Bán được {fmt(sellPrice)} Coins</span>
                  <form method="post" action="/api/me/cards/sell">
                    <input type="hidden" name="code" value={inst.code} />
                    <button type="submit" className="player-btn sm">Bán ra Coins</button>
                  </form>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
