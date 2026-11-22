import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { cardInfo, userInstances, userWallet, BASE_VALUE, RARITY_VI } from "@/lib/tcg";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("vi-VN");

export default async function TcgCollectionPage() {
  const session = await currentSession();
  if (!session) {
    return (
      <div className="tcg-body">
        <div className="tcg-head">
          <h1>Bộ sưu tập của bạn</h1>
          <p>Đăng nhập bằng Discord để xem kho thẻ của mình.</p>
        </div>
        <Link className="tcg-btn" href="/api/auth/login">Đăng nhập bằng Discord</Link>
      </div>
    );
  }
  const [instances, wallet] = await Promise.all([userInstances(session.userId), userWallet(session.userId)]);
  const species = new Set(instances.map((i) => i.speciesId)).size;
  const value = instances.reduce((s, i) => s + (BASE_VALUE[cardInfo(i.speciesId)?.rarity ?? "Common"] ?? 0), 0);
  return (
    <div className="tcg-body">
      <div className="tcg-head">
        <h1>Bộ sưu tập của {session.username}</h1>
        <p>{instances.length} lá thẻ · {species}/411 loài · Giá trị tham khảo {fmt(value)} Coins · {fmt(wallet.shards)} Mảnh thẻ · Gói: {wallet.packsStandard} thường / {wallet.packsPremium} cao cấp</p>
      </div>
      {instances.length === 0 ? (
        <p className="tcg-empty">Chưa có thẻ nào — vào Discord dùng lệnh <code>gacha single</code> để mở lá đầu tiên.</p>
      ) : (
        <div className="tcg-grid">
          {instances.map((inst) => {
            const info = cardInfo(inst.speciesId);
            return (
              <article className="tcg-card" key={inst.code}>
                <img src={`/cards/${inst.speciesId}.png`} alt={info?.name ?? inst.speciesId} loading="lazy" />
                <div className="tcg-card-meta">
                  <strong>{info?.name ?? inst.speciesId}</strong>
                  <span>{RARITY_VI[info?.rarity ?? "Common"]} · Lv.{inst.level} +{inst.enhance}</span>
                  <span className="tcg-num"><code>{inst.code}</code>{inst.locked ? " · Đã khoá" : ""}{inst.favorite ? " · Yêu thích" : ""}</span>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
