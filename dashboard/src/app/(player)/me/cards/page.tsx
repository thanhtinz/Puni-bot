import { currentSession } from "@/lib/current-session";
import { cardInfo, userInstances, userWallet, RARITY_VI } from "@/lib/tcg";
import { cardValue, getSellRatePercent } from "@/lib/player";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("vi-VN");

export default async function MeCardsPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [instances, wallet, rate] = await Promise.all([
    userInstances(session.userId),
    userWallet(session.userId),
    getSellRatePercent(),
  ]);
  const totalValue = instances.reduce(
    (s, i) => s + cardValue(cardInfo(i.speciesId)?.rarity ?? "Common", i.level, i.enhance), 0,
  );
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
            const info = cardInfo(inst.speciesId);
            const value = cardValue(info?.rarity ?? "Common", inst.level, inst.enhance);
            const sellPrice = Math.max(1, Math.floor((value * rate) / 100));
            return (
              <article className="tcg-card" key={inst.code}>
                <img src={`/cards/${inst.speciesId}.png`} alt={info?.name ?? inst.speciesId} loading="lazy" />
                <div className="tcg-card-meta">
                  <strong>{info?.name ?? inst.speciesId}</strong>
                  <span>{RARITY_VI[info?.rarity ?? "Common"]} · Lv.{inst.level} +{inst.enhance} · <code>{inst.code}</code></span>
                  <span className="tcg-price">Giá trị {fmt(value)} · Bán được {fmt(sellPrice)} Coins</span>
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
