import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { battleTeamPreview, lastBattle } from "@/lib/battle";
import CardArt from "@/components/card-art";
import CardBack from "@/components/card-back";
import BattleArena from "@/components/battle-arena";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Đấu thẻ trên web (spec 6.24): cùng engine, cùng thưởng với lệnh
 * cardbattle trong Discord — đội là 5 thẻ đầu của bộ bài đang dùng,
 * thắng ăn Coins + XP thẻ, thua vẫn có ít Coins an ủi. Hồi chiêu 20 giây.
 */
export default async function MeBattlePage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; done?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [economy, preview] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    battleTeamPreview(session.userId),
  ]);
  const balance = economy?.balance ?? 0;
  const result = sp.done ? lastBattle(session.userId) : undefined;

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Đấu thẻ</h1>
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">Số dư {fmt(balance)} Coins</p>

      {"error" in preview ? (
        <p className="player-notice err">{preview.error}</p>
      ) : (
        <section className="gacha-block versus-block">
          <h2>Đội của bạn — bộ bài &ldquo;{preview.deckName}&rdquo;</h2>
          <div className="arena-stage versus-stage">
            <div className="arena-row versus-row is-enemy">
              {preview.cards.map((c, i) => (
                <figure className="battle-card" key={i}>
                  <CardBack label="?" />
                  <figcaption>Đối thủ ẩn</figcaption>
                </figure>
              ))}
            </div>
            <div className="arena-midline">
              <span className="arena-vs">VS</span>
            </div>
            <div className="arena-row versus-row">
              {preview.cards.map((c) => (
                <figure className="battle-card" key={c.code}>
                  <CardArt src={c.spriteUrl} alt={c.name} rarity={c.rarity} />
                  <figcaption>{c.name} · Lv.{c.level}</figcaption>
                </figure>
              ))}
            </div>
          </div>
          <form method="post" action="/api/me/battle" className="gacha-actions">
            <input type="hidden" name="kind" value="fight" />
            <button type="submit" className="player-btn">Đấu một trận</button>
          </form>
          <p className="player-sub">
            Đối thủ là đội máy có cấp trung bình ngang đội bạn. Thắng: Coins + XP cho cả 5 thẻ ·
            Thua: vẫn nhận ít Coins. Hồi chiêu 20 giây giữa hai trận.
          </p>
        </section>
      )}

      {result ? (
        <BattleArena
          key={`${result.rounds}-${result.coins}-${result.events.length}`}
          outcome={result}
          againForm={
            <form method="post" action="/api/me/battle" className="gacha-actions">
              <input type="hidden" name="kind" value="fight" />
              <button type="submit" className="player-btn">Đấu tiếp</button>
            </form>
          }
        />
      ) : null}
    </div>
  );
}
