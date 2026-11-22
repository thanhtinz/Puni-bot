import { currentSession } from "@/lib/current-session";
import { userDecks, userInstances } from "@/lib/tcg";
import CardArt from "@/components/card-art";
import { validateDeckWeb } from "@/lib/player-deck";

export const dynamic = "force-dynamic";

export default async function MeDecksPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [decks, instances] = await Promise.all([userDecks(session.userId), userInstances(session.userId)]);
  const byCode = new Map(instances.map((i) => [i.code, i]));
  return (
    <div className="player-body-inner">
      <h1>Bộ bài của {session.username}</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">Bộ bài đang dùng là đội hình mang đi battle thẻ (5 thẻ đầu tiên ra trận). Luật hợp lệ: đúng 30 thẻ, tối đa 3 bản mỗi loài, ít nhất 10 loài.</p>
      {decks.length === 0 ? (
        <p className="player-notice">Chưa có bộ bài nào — tạo trong Discord bằng <code>deck create &lt;tên&gt;</code> rồi quay lại đây quản lý.</p>
      ) : decks.map((deck) => {
        const speciesIds = deck.codes.map((c) => byCode.get(c)?.speciesId ?? c);
        const errors = validateDeckWeb(speciesIds);
        return (
          <section className="player-panel" key={deck.id}>
            <h2>#{deck.id} {deck.name} — {deck.codes.length}/30 thẻ{deck.isActive ? " · Đang dùng" : ""}</h2>
            <p className={errors.length ? "player-err-text" : "player-ok-text"}>
              {errors.length ? `Chưa hợp lệ: ${errors.join("; ")}` : "Hợp lệ — sẵn sàng battle."}
            </p>
            <div className="tcg-deck-strip">
              {deck.codes.map((code) => {
                const inst = byCode.get(code);
                return (
                  <figure key={code}>
                    <CardArt src={inst?.spriteUrl ?? ""} alt={inst?.name ?? code} rarity={inst?.rarity} />
                    <figcaption>{inst?.name ?? code}</figcaption>
                    <form method="post" action="/api/me/decks">
                      <input type="hidden" name="action" value="remove" />
                      <input type="hidden" name="deckId" value={deck.id} />
                      <input type="hidden" name="code" value={code} />
                      <button type="submit" className="player-btn sm ghost">Gỡ</button>
                    </form>
                  </figure>
                );
              })}
            </div>
            <div className="player-row">
              {!deck.isActive ? (
                <form method="post" action="/api/me/decks">
                  <input type="hidden" name="action" value="set-active" />
                  <input type="hidden" name="deckId" value={deck.id} />
                  <button type="submit" className="player-btn">Đặt làm bộ đang dùng</button>
                </form>
              ) : null}
              <form method="post" action="/api/me/decks" className="player-inline-form">
                <input type="hidden" name="action" value="add" />
                <input type="hidden" name="deckId" value={deck.id} />
                <input type="text" name="code" placeholder="Mã thẻ 8 ký tự" maxLength={8} required />
                <button type="submit" className="player-btn sm">Thêm thẻ</button>
              </form>
            </div>
            <div className="player-row">
              {deck.isPublic ? (
                <>
                  <p className="player-ok-text">Đang công khai ở mục Tìm Bộ Bài · {deck.importCount} lượt dùng</p>
                  <form method="post" action="/api/me/decks">
                    <input type="hidden" name="action" value="unpublish" />
                    <input type="hidden" name="deckId" value={deck.id} />
                    <button type="submit" className="player-btn sm ghost">Huỷ công khai</button>
                  </form>
                </>
              ) : errors.length === 0 ? (
                <form method="post" action="/api/me/decks" className="player-inline-form">
                  <input type="hidden" name="action" value="publish" />
                  <input type="hidden" name="deckId" value={deck.id} />
                  <input type="text" name="description" placeholder="Mô tả ngắn cho bộ bài (tuỳ chọn)" maxLength={200} />
                  <button type="submit" className="player-btn sm">Công khai bộ này</button>
                </form>
              ) : (
                <p className="player-sub">Bộ hợp lệ (đủ 30 thẻ) mới công khai cho người khác dùng được.</p>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
