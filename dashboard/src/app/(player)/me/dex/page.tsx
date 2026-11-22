import { currentSession } from "@/lib/current-session";
import { dexOwnedSpecies } from "@/lib/player";
import { listGameSets } from "@/lib/db";
import { TCG_CARDS, RARITY_VI } from "@/lib/tcg";

export const dynamic = "force-dynamic";

/**
 * Collection dex (spec 6.27): grouped BY SET — Tuxemon is only the
 * first set; every set gets its own section and its own progress.
 */
export default async function MeDexPage() {
  const session = (await currentSession())!;
  const [owned, sets] = await Promise.all([
    dexOwnedSpecies(session.userId),
    listGameSets().catch(() => []),
  ]);
  const setName = new Map(sets.map((s) => [s.id, s.name]));
  const bySet = new Map<string, typeof TCG_CARDS>();
  for (const c of TCG_CARDS) {
    const list = bySet.get(c.set) ?? [];
    list.push(c);
    bySet.set(c.set, list);
  }
  const orderedSets = [...bySet.entries()].sort((a, b) => {
    const sa = sets.find((s) => s.id === a[0])?.sort ?? 99;
    const sb = sets.find((s) => s.id === b[0])?.sort ?? 99;
    return sa - sb;
  });
  const total = TCG_CARDS.length;
  return (
    <div className="player-body-inner">
      <h1>Sổ dex — {owned.size}/{total} loài đã có</h1>
      <p className="player-sub">Loài đã sở hữu qua thẻ TCG hiện rõ nét; loài chưa có hiện mờ. Mỗi bộ thẻ có sổ dex và tiến độ riêng.</p>
      <div className="player-progress"><div style={{ width: `${total ? (owned.size / total) * 100 : 0}%` }} /></div>
      {orderedSets.map(([setId, cards]) => {
        const ownedInSet = cards.filter((c) => owned.has(c.slug)).length;
        return (
          <section key={setId} style={{ marginTop: 26 }}>
            <h2 className="player-h2">
              {setName.get(setId) ?? setId} — {ownedInSet}/{cards.length} loài
            </h2>
            <div className="player-progress"><div style={{ width: `${cards.length ? (ownedInSet / cards.length) * 100 : 0}%` }} /></div>
            <div className="dex-grid">
              {cards.map((c) => {
                const has = owned.has(c.slug);
                return (
                  <figure key={c.slug} className={has ? "dex-cell" : "dex-cell missing"}>
                    <img src={`/cards/${c.slug}.png`} alt={has ? c.name : "Chưa có"} loading="lazy" />
                    <figcaption>
                      <strong>{has ? c.name : "?????"}</strong>
                      <span>N°{c.number} · {RARITY_VI[c.rarity] ?? c.rarity}</span>
                    </figcaption>
                  </figure>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
