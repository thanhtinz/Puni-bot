import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { userWallet, RARITY_VI, speciesDisplay } from "@/lib/tcg";
import CardArt from "@/components/card-art";
import TiltCard from "@/components/tilt-card";
import SlabCard, { gradeForRarity } from "@/components/slab-card";
import {
  featuredCards,
  SHOP_PACK_PRICES,
  shopCatalog,
  shopSets,
  shopGameOf,
  SHOP_GAMES,
  CATALOG_PAGE_SIZE,
  CATALOG_RARITIES,
  type CatalogCard,
  type FeaturedCard,
} from "@/lib/shop";
import { getSellRatePercent } from "@/lib/player";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/** Card art with the plastic treatment: Epic+ in a graded slab,
 *  Rare in a clear toploader, everything wrapped in the tilt effect. */
function ShopArt({ id, name, spriteUrl, rarity, setName }: {
  id: string; name: string; spriteUrl: string; rarity: string; setName: string;
}) {
  const grade = gradeForRarity(rarity);
  return (
    <TiltCard holo={grade != null}>
      {grade ? (
        <SlabCard
          variant="shop"
          imageUrl={spriteUrl}
          name={name}
          setLine={setName}
          grade={grade}
          cert={id.split("-").slice(0, 2).join("-").toUpperCase()}
        />
      ) : rarity === "Rare" ? (
        <div className="toploader">
          <CardArt src={spriteUrl} alt={name} rarity={rarity} />
        </div>
      ) : (
        <CardArt src={spriteUrl} alt={name} rarity={rarity} />
      )}
    </TiltCard>
  );
}

function BuySingleForm({ speciesId, price, balance }: { speciesId: string; price: number; balance: number }) {
  return (
    <form method="post" action="/api/me/shop">
      <input type="hidden" name="kind" value="card-single" />
      <input type="hidden" name="species" value={speciesId} />
      <button type="submit" className="player-btn" disabled={balance < price}>
        Mua · {fmt(price)} Coins
      </button>
    </form>
  );
}

function CatalogCell({ c, balance, index }: { c: CatalogCard; balance: number; index: number }) {
  return (
    <article
      className={`tcg-card rarity-${c.rarity.toLowerCase()} shop-cell`}
      style={{ animationDelay: `${Math.min(index, 14) * 35}ms` }}
    >
      <Link href={`/me/shop/${c.speciesId}`} className="shop-cell-art" aria-label={c.name}>
        <ShopArt id={c.speciesId} name={c.name} spriteUrl={c.spriteUrl} rarity={c.rarity} setName={c.setName} />
      </Link>
      <h3>
        <Link href={`/me/shop/${c.speciesId}`}>{c.name}</Link>
      </h3>
      <p className="player-sub">
        {RARITY_VI[c.rarity] ?? c.rarity} · {c.setName}
        {c.memberExclusive ? " · Độc quyền hội viên" : ""}
      </p>
      <BuySingleForm speciesId={c.speciesId} price={c.price} balance={balance} />
    </article>
  );
}

/**
 * Shop bán thẻ (spec 6.36): kiểu sàn TCG — tab Thẻ lẻ có tìm kiếm,
 * lọc theo game/bộ/độ hiếm, sắp xếp và phân trang trên toàn bộ danh
 * mục; tab Gói thẻ giữ cách mua gói cũ. Giá luôn do server tính lại.
 */
export default async function MeShopPage({
  searchParams,
}: {
  searchParams: Promise<{
    tab?: string; q?: string; game?: string; set?: string; rarity?: string;
    sort?: string; page?: string; msg?: string; err?: string; bought?: string;
  }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const tab = sp.tab === "goi" ? "goi" : "the";
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);
  const hasFilters = Boolean(sp.q || sp.game || sp.set || sp.rarity);

  const [economy, wallet, sellRate] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    userWallet(session.userId),
    getSellRatePercent().catch(() => 60),
  ]);
  const balance = economy?.balance ?? 0;

  const catalog = tab === "the"
    ? await shopCatalog({ q: sp.q, game: sp.game, set: sp.set, rarity: sp.rarity, sort: sp.sort, page })
    : { rows: [], total: 0 };
  const sets = tab === "the" && sp.game ? await shopSets(sp.game) : [];
  const shelf = tab === "the" && !hasFilters && page === 1 ? await featuredCards() : [];
  const boughtInfo = sp.bought ? (await speciesDisplay([sp.bought])).get(sp.bought) : undefined;
  const totalPages = Math.max(1, Math.ceil(catalog.total / CATALOG_PAGE_SIZE));

  const pageHref = (p: number) => {
    const u = new URLSearchParams();
    u.set("tab", "the");
    if (sp.q) u.set("q", sp.q);
    if (sp.game) u.set("game", sp.game);
    if (sp.set) u.set("set", sp.set);
    if (sp.rarity) u.set("rarity", sp.rarity);
    if (sp.sort) u.set("sort", sp.sort);
    if (p > 1) u.set("page", String(p));
    return `/me/shop?${u.toString()}`;
  };

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Shop thẻ</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">
        Gói Thường đang có: {wallet.packsStandard} · Gói Cao Cấp: {wallet.packsPremium}
      </p>

      <nav className="shop-tabs" aria-label="Shop">
        <Link className={tab === "the" ? "active" : ""} href="/me/shop">Thẻ lẻ</Link>
        <Link className={tab === "goi" ? "active" : ""} href="/me/shop?tab=goi">Gói thẻ</Link>
      </nav>

      {tab === "goi" ? (
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
      ) : (
        <>
          {shelf.length ? (
            <section className="gacha-block">
              <h2>Thẻ nổi bật hôm nay</h2>
              <p className="player-sub">Kệ hàng thay mới mỗi ngày lúc 00:00 UTC.</p>
              <div className="shop-featured-row">
                {shelf.map((f: FeaturedCard) => (
                  <article className={`tcg-card rarity-${f.rarity.toLowerCase()} shop-cell`} key={f.speciesId}>
                    <Link href={`/me/shop/${f.speciesId}`} className="shop-cell-art" aria-label={f.name}>
                      <ShopArt
                        id={f.speciesId}
                        name={f.name}
                        spriteUrl={f.spriteUrl}
                        rarity={f.rarity}
                        setName={shopGameOf(f.speciesId)?.name ?? ""}
                      />
                    </Link>
                    <h3>
                      <Link href={`/me/shop/${f.speciesId}`}>{f.name}</Link>
                    </h3>
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
                ))}
              </div>
            </section>
          ) : null}

          <section className="gacha-block">
            <h2>Tất cả thẻ lẻ</h2>
            <form className="shop-filters" method="get" action="/me/shop">
              <input type="hidden" name="tab" value="the" />
              <input
                className="shop-search"
                type="search"
                name="q"
                defaultValue={sp.q ?? ""}
                placeholder="Tìm theo tên thẻ…"
                aria-label="Tìm theo tên thẻ"
              />
              <select name="game" defaultValue={sp.game ?? ""} aria-label="Game">
                <option value="">Tất cả game</option>
                {SHOP_GAMES.map((g) => (
                  <option key={g.prefix} value={g.prefix}>{g.name}</option>
                ))}
              </select>
              {sp.game ? (
                <select name="set" defaultValue={sp.set ?? ""} aria-label="Bộ thẻ">
                  <option value="">Tất cả bộ</option>
                  {sets.map((s) => (
                    <option key={s.id} value={s.id}>{s.name} ({fmt(s.count)})</option>
                  ))}
                </select>
              ) : null}
              <select name="rarity" defaultValue={sp.rarity ?? ""} aria-label="Độ hiếm">
                <option value="">Mọi độ hiếm</option>
                {CATALOG_RARITIES.map((r) => (
                  <option key={r} value={r}>{RARITY_VI[r] ?? r}</option>
                ))}
              </select>
              <select name="sort" defaultValue={sp.sort ?? "value-desc"} aria-label="Sắp xếp">
                <option value="value-desc">Giá trị: cao → thấp</option>
                <option value="price-asc">Giá trị: thấp → cao</option>
                <option value="rarity">Độ hiếm</option>
                <option value="name">Tên A → Z</option>
              </select>
              <button type="submit" className="player-btn">Lọc</button>
              {hasFilters ? <Link className="shop-reset" href="/me/shop">Xoá lọc</Link> : null}
            </form>
            <p className="player-sub">
              {fmt(catalog.total)} thẻ · Giá bằng giá trị hệ thống của thẻ ở cấp 1 — bán lại cho hệ thống được {sellRate}% giá trị.
              Thẻ Sử thi trở lên được đóng khung nhựa có tem grade, thẻ Hiếm đựng trong khung nhựa trong.
            </p>
            {catalog.rows.length === 0 ? (
              <p className="player-notice">Không tìm thấy thẻ nào khớp bộ lọc.</p>
            ) : (
              <div className="tcg-grid shop-grid">
                {catalog.rows.map((c, i) => (
                  <CatalogCell key={c.speciesId} c={c} balance={balance} index={i} />
                ))}
              </div>
            )}
            {totalPages > 1 ? (
              <nav className="shop-pager" aria-label="Phân trang">
                {page > 1 ? <Link href={pageHref(page - 1)}>← Trước</Link> : <span className="off">← Trước</span>}
                <span>Trang {page} / {totalPages}</span>
                {page < totalPages ? <Link href={pageHref(page + 1)}>Sau →</Link> : <span className="off">Sau →</span>}
              </nav>
            ) : null}
          </section>
        </>
      )}

      {boughtInfo ? (
        <div className="bought-overlay" role="dialog" aria-label="Thẻ vừa mua">
          <div className="bought-card">
            <TiltCard holo={gradeForRarity(boughtInfo.rarity) != null}>
              {gradeForRarity(boughtInfo.rarity) ? (
                <SlabCard
                  imageUrl={boughtInfo.spriteUrl}
                  name={boughtInfo.name}
                  setLine={boughtInfo.setName}
                  grade={gradeForRarity(boughtInfo.rarity)!}
                  cert={sp.bought!.split("-").slice(0, 2).join("-").toUpperCase()}
                />
              ) : (
                <CardArt src={boughtInfo.spriteUrl} alt={boughtInfo.name} rarity={boughtInfo.rarity} />
              )}
            </TiltCard>
            <h3>{boughtInfo.name}</h3>
            <p className="player-sub">Đã thêm vào Kho thẻ của bạn.</p>
            <div className="gacha-actions">
              <Link className="player-btn" href="/me/cards">Xem Kho thẻ</Link>
              <Link className="player-btn" href="/me/shop">Mua tiếp</Link>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
