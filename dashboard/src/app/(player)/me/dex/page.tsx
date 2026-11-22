import { currentSession } from "@/lib/current-session";
import { dexOwnedSpecies } from "@/lib/player";
import { TCG_CARDS, RARITY_VI } from "@/lib/tcg";

export const dynamic = "force-dynamic";

export default async function MeDexPage() {
  const session = (await currentSession())!;
  const owned = await dexOwnedSpecies(session.userId);
  return (
    <div className="player-body-inner">
      <h1>Sổ dex — {owned.size}/411 loài đã có</h1>
      <p className="player-sub">Loài đã sở hữu qua thẻ TCG hiện rõ nét; loài chưa có hiện mờ. Khi game thú cưng mở, thú đã bắt cũng sẽ tính vào sổ này.</p>
      <div className="player-progress"><div style={{ width: `${(owned.size / 411) * 100}%` }} /></div>
      <div className="dex-grid">
        {TCG_CARDS.map((c) => {
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
    </div>
  );
}
