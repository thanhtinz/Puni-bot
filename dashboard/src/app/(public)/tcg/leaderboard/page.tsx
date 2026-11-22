import { topCollectors, TCG_CARDS } from "@/lib/tcg";

export const dynamic = "force-dynamic";

export default async function TcgLeaderboardPage() {
  const top = await topCollectors(20);
  return (
    <div className="tcg-body">
      <div className="tcg-head">
        <h1>Bảng xếp hạng nhà sưu tập</h1>
        <p>Xếp theo số loài thẻ sở hữu (tổng {TCG_CARDS.length} loài), sau đó tới tổng số lá.</p>
      </div>
      <section className="tcg-panel">
        {top.length === 0 ? (
          <p className="tcg-empty">Chưa có dữ liệu — hãy là nhà sưu tập đầu tiên.</p>
        ) : top.map((row, i) => (
          <div className="tcg-row" key={row.userId}>
            <span className="tcg-rank">{i + 1}</span>
            <div className="tcg-row-main">
              <strong>Người chơi {row.userId.slice(0, 6)}…</strong>
              <span>{row.species} loài · {row.instances} lá thẻ</span>
            </div>
            <span className="tcg-badge">{Math.round((row.species / TCG_CARDS.length) * 100)}% bộ sưu tập</span>
          </div>
        ))}
      </section>
    </div>
  );
}
