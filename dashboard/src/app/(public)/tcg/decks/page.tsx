import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { cardInfo, userDecks, userInstances } from "@/lib/tcg";

export const dynamic = "force-dynamic";

export default async function TcgDecksPage() {
  const session = await currentSession();
  if (!session) {
    return (
      <div className="tcg-body">
        <div className="tcg-head">
          <h1>Bộ bài của bạn</h1>
          <p>Đăng nhập bằng Discord để xem các bộ bài đã xây.</p>
        </div>
        <Link className="tcg-btn" href="/api/auth/login">Đăng nhập bằng Discord</Link>
      </div>
    );
  }
  const [decks, instances] = await Promise.all([userDecks(session.userId), userInstances(session.userId)]);
  const byCode = new Map(instances.map((i) => [i.code, i]));
  return (
    <div className="tcg-body">
      <div className="tcg-head">
        <h1>Bộ bài của {session.username}</h1>
        <p>Xây và chỉnh bộ bài trong Discord bằng lệnh <code>deck</code> — trang này để xem lại. Bộ bài đang dùng là đội hình mang đi battle.</p>
      </div>
      {decks.length === 0 ? (
        <p className="tcg-empty">Chưa có bộ bài nào — tạo bằng <code>deck create &lt;tên&gt;</code> trong Discord.</p>
      ) : decks.map((deck) => (
        <section className="tcg-panel" key={deck.id} style={{ marginBottom: 18 }}>
          <h2>#{deck.id} {deck.name} — {deck.codes.length}/30 thẻ{deck.isActive ? " · Đang dùng" : ""}</h2>
          <div className="tcg-deck-strip">
            {deck.codes.map((code) => {
              const inst = byCode.get(code);
              const info = inst ? cardInfo(inst.speciesId) : undefined;
              return (
                <figure key={code} title={`${info?.name ?? code} (${code})`}>
                  <img src={`/cards/${inst?.speciesId ?? ""}.png`} alt={info?.name ?? code} loading="lazy" />
                  <figcaption>{info?.name ?? code}</figcaption>
                </figure>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
