import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { searchPublicDecks, publicDeckDetail, fmtCoins, type PublicDeck } from "@/lib/deck-search";
import { SHOP_GAMES } from "@/lib/shop";
import CardArt from "@/components/card-art";

export const dynamic = "force-dynamic";

function DeckMeta({ deck }: { deck: PublicDeck }) {
  return (
    <p className="deck-meta">
      của <strong>{deck.authorName}</strong> · {deck.cardCount} thẻ · {deck.speciesCount} loài ·
      giá trị {fmtCoins(deck.totalValue)} Coins · {deck.importCount} lượt dùng
    </p>
  );
}

function AdoptForm({ deck, own }: { deck: PublicDeck; own: boolean }) {
  if (own) return <p className="player-ok-text">Bộ bài của bạn</p>;
  return (
    <form method="post" action="/api/me/deck-search">
      <input type="hidden" name="action" value="adopt" />
      <input type="hidden" name="deckId" value={deck.id} />
      <button type="submit" className="player-btn">Dùng bộ này</button>
    </form>
  );
}

export default async function DeckSearchPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; family?: string; card?: string; sort?: string; deck?: string; msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const detailId = sp.deck ? Number.parseInt(sp.deck, 10) : NaN;

  if (Number.isInteger(detailId)) {
    const deck = await publicDeckDetail(detailId);
    return (
      <div className="player-body-inner">
        <p><Link href="/me/deck-search" className="player-back">← Tất cả bộ công khai</Link></p>
        <h1>{deck ? deck.name : "Không tìm thấy bộ bài"}</h1>
        {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
        {deck ? (
          <section className="player-panel">
            <DeckMeta deck={deck} />
            {deck.families.length ? (
              <div className="deck-families">{deck.families.map((f) => <span key={f}>{f}</span>)}</div>
            ) : null}
            {deck.description ? <p className="deck-desc-full">{deck.description}</p> : null}
            <div className="tcg-deck-strip">
              {deck.lines.map((l) => (
                <figure key={l.speciesId}>
                  <CardArt src={l.spriteUrl} alt={l.name} rarity={l.rarity} />
                  <figcaption>{l.name}{l.count > 1 ? ` ×${l.count}` : ""}</figcaption>
                </figure>
              ))}
            </div>
            <div className="player-row">
              <AdoptForm deck={deck} own={deck.authorId === session.userId} />
            </div>
          </section>
        ) : (
          <p className="player-notice">Bộ bài này không còn công khai.</p>
        )}
      </div>
    );
  }

  const decks = await searchPublicDecks({
    q: sp.q ?? "", family: sp.family ?? "", card: sp.card ?? "", sort: sp.sort ?? "new",
  });
  return (
    <div className="player-body-inner">
      <h1>Tìm Bộ Bài</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">Bộ bài người chơi khác công khai — dùng ngay bằng thẻ của chính bạn nếu đã có đủ.</p>
      <section className="player-panel">
        <form method="get" action="/me/deck-search" className="deck-filter">
          <input type="text" name="q" placeholder="Tên bộ bài hoặc người đăng" defaultValue={sp.q ?? ""} maxLength={60} />
          <select name="family" defaultValue={sp.family ?? ""}>
            <option value="">Tất cả game</option>
            {SHOP_GAMES.map((g) => (
              <option key={g.prefix} value={g.prefix}>{g.name}</option>
            ))}
          </select>
          <input type="text" name="card" placeholder="Có chứa thẻ…" defaultValue={sp.card ?? ""} maxLength={60} />
          <select name="sort" defaultValue={sp.sort ?? "new"}>
            <option value="new">Mới nhất</option>
            <option value="used">Được dùng nhiều</option>
          </select>
          <button type="submit" className="player-btn">Tìm</button>
        </form>
      </section>
      {decks.length === 0 ? (
        <p className="player-notice">Chưa có bộ công khai nào khớp — quay lại sau, hoặc công khai bộ của bạn ở trang Bộ Bài.</p>
      ) : (
        <div className="deck-search-grid">
          {decks.map((deck) => (
            <section className="player-panel deck-card" key={deck.id}>
              <h2>{deck.name}</h2>
              <DeckMeta deck={deck} />
              {deck.families.length ? (
                <div className="deck-families">{deck.families.map((f) => <span key={f}>{f}</span>)}</div>
              ) : null}
              {deck.description ? <p className="deck-desc">{deck.description}</p> : null}
              <div className="tcg-deck-strip">
                {deck.lines.slice(0, 5).map((l) => (
                  <figure key={l.speciesId}>
                    <CardArt src={l.spriteUrl} alt={l.name} rarity={l.rarity} />
                    <figcaption>{l.name}{l.count > 1 ? ` ×${l.count}` : ""}</figcaption>
                  </figure>
                ))}
              </div>
              <div className="player-row">
                <Link href={`/me/deck-search?deck=${deck.id}`} className="player-btn ghost">Xem bộ</Link>
                <AdoptForm deck={deck} own={deck.authorId === session.userId} />
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
