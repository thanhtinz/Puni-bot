import { currentSession } from "@/lib/current-session";
import { fmtCoins } from "@/lib/player";
import { RARITY_VI } from "@/lib/tcg";
import {
  SHOWCASE_EFFECTS, SHOWCASE_LAYOUTS, SHOWCASE_MAX_PINS, SHOWCASE_THEMES,
  getShowcase, getShowcaseCards, getShowcasePrice, hasPremiumShowcase,
  listPinnableCards, themeUnlocked,
} from "@/lib/showcase";
import { ShowcaseStage } from "@/components/showcase-stage";

export const metadata = { title: "Trang trưng bày — Puni" };

/** Collection Showcase owner page (spec 6.30): buy the page, pin up to
 *  12 cards, customize layout / background / effect, public toggle. */
export default async function ShowcasePage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const sp = await searchParams;
  const session = (await currentSession())!;
  const sc = await getShowcase(session.userId);
  const premium = await hasPremiumShowcase(session.userId);

  if (!sc.owned) {
    const price = await getShowcasePrice();
    return (
      <main className="player-main">
        <h1>Trang trưng bày bộ sưu tập</h1>
        {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
        {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
        <section className="player-card sc-buy">
          <p>
            Mở một trang trưng bày riêng để khoe những lá thẻ hiếm nhất của bạn: ghim tối đa{" "}
            {SHOWCASE_MAX_PINS} thẻ, tuỳ chỉnh bố cục, nền và hiệu ứng, rồi chia sẻ link công khai
            cho mọi người xem.
          </p>
          <ul className="sc-perks">
            <li>Ghim {SHOWCASE_MAX_PINS} thẻ hiếm lên sân khấu riêng</li>
            <li>3 bố cục · 6 nền (3 nền mở khoá thêm bằng Coins) · hiệu ứng holo / lướt sáng</li>
            <li>Link công khai để khoe bộ sưu tập ra ngoài Discord</li>
          </ul>
          {premium ? (
            <p className="player-notice ok">Gói Premium của bạn đã gồm trang trưng bày — đang kích hoạt…</p>
          ) : (
            <form method="post" action="/api/me/showcase">
              <input type="hidden" name="action" value="buy" />
              <button type="submit" className="player-btn">Mở trang trưng bày · {fmtCoins(price)} Coins</button>
            </form>
          )}
        </section>
      </main>
    );
  }

  const [cards, pinnable] = await Promise.all([
    getShowcaseCards(session.userId, sc.pins),
    listPinnableCards(session.userId),
  ]);
  const pinnedSet = new Set(cards.map((c) => c.code));
  const publicUrl = `/showcase/${session.userId}`;

  return (
    <main className="player-main">
      <h1>Trang trưng bày bộ sưu tập</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}

      <ShowcaseStage
        cards={cards}
        layout={sc.layout}
        theme={sc.theme}
        effect={sc.effect}
        title={`Bộ sưu tập của ${session.username}`}
        subtitle={sc.isPublic ? `Link công khai: ${publicUrl}` : "Đang tắt công khai"}
      />

      <section className="player-card">
        <h2 className="mk-h2">Tuỳ chỉnh</h2>
        <form method="post" action="/api/me/showcase" className="sc-settings">
          <input type="hidden" name="action" value="save" />
          <label>
            Bố cục
            <select name="layout" defaultValue={sc.layout}>
              {SHOWCASE_LAYOUTS.map((l) => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </label>
          <label>
            Nền
            <select name="theme" defaultValue={sc.theme}>
              {SHOWCASE_THEMES.filter((t) => themeUnlocked(sc, t.id)).map((t) => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
            </select>
          </label>
          <label>
            Hiệu ứng
            <select name="effect" defaultValue={sc.effect}>
              {SHOWCASE_EFFECTS.map((e) => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </label>
          <label className="sc-check">
            <input type="checkbox" name="isPublic" defaultChecked={sc.isPublic} />
            Công khai trang trưng bày
          </label>
          <button type="submit" className="player-btn">Lưu tuỳ chỉnh</button>
        </form>

        {SHOWCASE_THEMES.filter((t) => !themeUnlocked(sc, t.id)).length > 0 ? (
          <div className="sc-themes">
            <h3>Nền chưa mở khoá</h3>
            <div className="sc-theme-row">
              {SHOWCASE_THEMES.filter((t) => !themeUnlocked(sc, t.id)).map((t) => (
                <form key={t.id} method="post" action="/api/me/showcase" className="sc-theme-item">
                  <input type="hidden" name="action" value="buy-theme" />
                  <input type="hidden" name="theme" value={t.id} />
                  <span className={`sc-swatch sc-swatch-${t.id}`} aria-hidden="true" />
                  <span>{t.name}</span>
                  <button type="submit">Mở khoá · {fmtCoins(t.price)} Coins</button>
                </form>
              ))}
            </div>
          </div>
        ) : null}
      </section>

      <section className="player-card">
        <h2 className="mk-h2">Ghim thẻ ({cards.length}/{SHOWCASE_MAX_PINS})</h2>
        {pinnable.length === 0 ? (
          <p>Bạn chưa có thẻ nào trong kho.</p>
        ) : (
          <ul className="sc-pinlist">
            {pinnable.map((c) => {
              const pinned = pinnedSet.has(c.code);
              return (
                <li key={c.code} className="sc-pinrow">
                  {c.spriteUrl ? <img src={c.spriteUrl} alt="" loading="lazy" /> : null}
                  <span className="sc-pin-name">
                    <strong>{c.name}</strong>
                    <small>
                      {RARITY_VI[c.rarity] ?? c.rarity} · Lv.{c.level} +{c.enhance} · {c.code} · {fmtCoins(c.value)} Coins
                    </small>
                  </span>
                  <form method="post" action="/api/me/showcase">
                    <input type="hidden" name="action" value={pinned ? "unpin" : "pin"} />
                    <input type="hidden" name="code" value={c.code} />
                    <button type="submit" className={pinned ? "player-btn ghost sm" : "player-btn sm"}>
                      {pinned ? "Bỏ ghim" : "Ghim"}
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </main>
  );
}
