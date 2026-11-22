import { db } from "@/lib/db";
import { TCG_CARDS } from "@/lib/tcg";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("vi-VN");

interface BannerRow { id: string; name: string; kind: string; cost: string; ends_at: Date | null }

export default async function TcgShopPage() {
  let banners: BannerRow[] = [];
  try {
    const res = await db().query<BannerRow>(
      `SELECT id, name, kind, cost_coins::text AS cost, ends_at FROM tcg_banners
       WHERE enabled = true AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
       ORDER BY id`,
    );
    banners = res.rows;
  } catch { /* pre-migration */ }
  const legendaries = TCG_CARDS.filter((c) => ["Legendary", "Mythical", "Fabled"].includes(c.rarity)).slice(0, 4);
  return (
    <div className="tcg-body">
      <div className="tcg-head">
        <h1>Cửa hàng triệu hồi</h1>
        <p>Mở thẻ diễn ra trong Discord bằng lệnh <code>gacha</code>. Mỗi lượt mở +1 Điểm triệu hồi — đủ 100 điểm đổi 1 thẻ tự chọn trong banner bằng <code>gacha exchange</code>.</p>
      </div>
      <div className="tcg-top2">
        {banners.map((b) => (
          <section className="tcg-panel" key={b.id}>
            <h2>{b.name}</h2>
            <p>Giá: <strong>{fmt(Number.parseInt(b.cost, 10))} Coins</strong>/lượt · Mở 10 đảm bảo ít nhất 1 thẻ Hiếm.</p>
            <p>{b.kind === "beginner"
              ? "Dành cho tài khoản dưới 30 lượt mở tổng — multi đầu tiên chắc chắn có thẻ Huyền thoại."
              : "Toàn bộ 411 mẫu thẻ. Bảo hiểm: 30 lượt chắc chắn Sử thi+, 90 lượt chắc chắn Huyền thoại+."}</p>
            {b.ends_at ? <p>Kết thúc: {new Date(b.ends_at).toLocaleDateString("vi-VN")}</p> : null}
          </section>
        ))}
        <section className="tcg-panel">
          <h2>Gói thẻ</h2>
          <p><strong>Gói Thường</strong> — 5 thẻ, nhận từ quà ngày (<code>gacha free</code>), quà tuần (<code>weekly</code>) và thành tựu.</p>
          <p><strong>Gói Cao Cấp</strong> — 5 thẻ, lá cuối đảm bảo Sử thi trở lên; nhận từ thành tựu và sự kiện.</p>
          <p>Mở gói trong Discord: <code>gacha pack</code> / <code>gacha packpremium</code>.</p>
        </section>
      </div>
      <h2 className="tcg-h2">Thẻ đỉnh nhất trong cửa hàng</h2>
      <div className="tcg-grid">
        {legendaries.map((c) => (
          <article className="tcg-card" key={c.slug}>
            <img src={`/cards/${c.slug}.png`} alt={c.name} loading="lazy" />
            <div className="tcg-card-meta">
              <strong>{c.name}</strong>
              <span>{c.rarity} · Hệ {c.types} · HP {c.hp}</span>
              <span className="tcg-num">N°{c.number}</span>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
