import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { dexOwnedSpecies } from "@/lib/player";
import { dexSets, dexSetSpeciesIds, dexSpeciesPage, dexTotalSpecies, RARITY_VI } from "@/lib/tcg";
import CardArt from "@/components/card-art";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 96;
const fmt = (n: number) => n.toLocaleString("en-US");

/**
 * Collection dex (spec 6.27/6.29): one set at a time — the catalog
 * holds 160k+ real TCG cards across 2,000+ sets, so the dex is a set
 * picker plus a paginated grid. Owned species show in full colour;
 * missing ones stay dimmed with a hidden name.
 */
export default async function MeDexPage({
  searchParams,
}: {
  searchParams: Promise<{ set?: string; page?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [owned, sets, total] = await Promise.all([
    dexOwnedSpecies(session.userId),
    dexSets(),
    dexTotalSpecies(),
  ]);
  const current = sets.find((s) => s.id === sp.set) ?? sets.find((s) => s.id === "op01") ?? sets[0];
  const pageCount = current ? Math.max(1, Math.ceil(current.count / PAGE_SIZE)) : 1;
  const safePage = Math.min(Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1), pageCount);
  const [setIds, cards] = current
    ? await Promise.all([
        dexSetSpeciesIds(current.id),
        dexSpeciesPage(current.id, PAGE_SIZE, (safePage - 1) * PAGE_SIZE),
      ])
    : [[], []];
  const ownedInSet = setIds.filter((id) => owned.has(id)).length;

  return (
    <div className="player-body-inner">
      <h1>Sổ dex — {fmt(owned.size)}/{fmt(total)} loài đã có</h1>
      <p className="player-sub">Mỗi bộ thẻ có sổ dex và tiến độ riêng. Loài đã sở hữu hiện rõ nét; loài chưa có hiện mờ.</p>
      <div className="player-progress"><div style={{ width: `${total ? (owned.size / total) * 100 : 0}%` }} /></div>

      <form method="get" className="dex-picker">
        <label htmlFor="dex-set">Bộ thẻ</label>
        <select id="dex-set" name="set" defaultValue={current?.id ?? ""}>
          {sets.map((s) => (
            <option key={s.id} value={s.id}>
              {s.name} ({fmt(s.count)} lá)
            </option>
          ))}
        </select>
        <button type="submit" className="player-btn sm">Xem bộ này</button>
      </form>

      {current ? (
        <section style={{ marginTop: 22 }}>
          <h2 className="player-h2">
            {current.name} — {fmt(ownedInSet)}/{fmt(current.count)} loài
          </h2>
          <div className="player-progress">
            <div style={{ width: `${current.count ? (ownedInSet / current.count) * 100 : 0}%` }} />
          </div>
          <div className="dex-grid">
            {cards.map((c, i) => {
              const has = owned.has(c.id);
              return (
                <figure key={c.id} className={has ? "dex-cell" : "dex-cell missing"}>
                  <CardArt src={c.spriteUrl} alt={has ? c.name : "Chưa có"} rarity={c.rarity} />
                  <figcaption>
                    <strong>{has ? c.name : "?????"}</strong>
                    <span>N°{(safePage - 1) * PAGE_SIZE + i + 1} · {RARITY_VI[c.rarity] ?? c.rarity}</span>
                  </figcaption>
                </figure>
              );
            })}
          </div>
          {pageCount > 1 ? (
            <nav className="dex-pager" aria-label="Trang sổ dex">
              {safePage > 1 ? (
                <Link className="player-btn ghost sm" href={`/me/dex?set=${encodeURIComponent(current.id)}&page=${safePage - 1}`}>
                  ← Trang trước
                </Link>
              ) : null}
              <span>Trang {safePage}/{fmt(pageCount)}</span>
              {safePage < pageCount ? (
                <Link className="player-btn ghost sm" href={`/me/dex?set=${encodeURIComponent(current.id)}&page=${safePage + 1}`}>
                  Trang sau →
                </Link>
              ) : null}
            </nav>
          ) : null}
        </section>
      ) : (
        <p className="player-notice">Chưa có dữ liệu bộ thẻ nào.</p>
      )}
    </div>
  );
}
