import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { battleTeamPreview, lastBattle } from "@/lib/battle";
import {
  CHAIN_WINS,
  formatView,
  lastFormatEvent,
  type FormatView,
  type SpeciesView,
} from "@/lib/formats";
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
  searchParams: Promise<{ err?: string; done?: string; fmt?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [economy, preview, draftView, sealedView] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    battleTeamPreview(session.userId),
    formatView(session.userId, "draft").catch(() => null),
    formatView(session.userId, "sealed").catch(() => null),
  ]);
  const balance = economy?.balance ?? 0;
  const result = sp.done ? lastBattle(session.userId) : undefined;
  const fmtEvent = sp.fmt ? lastFormatEvent(session.userId) : undefined;

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Đấu thẻ</h1>
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}

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

      <section className="gacha-block fmt-block" id="formats">
        <h2>Hình thức đấu</h2>
        <p className="player-sub">
          Thử thách ngày dùng bộ bài của bạn; Draft và Sealed đấu bằng thẻ ảo rút tại chỗ —
          mỗi ngày 1 lượt miễn phí cho từng hình thức, lượt thêm tốn phí vào lượt.
          Tiến độ dùng chung với bot Discord.
        </p>

        {fmtEvent ? (
          <div className={`fmt-result ${fmtEvent.win ? "is-win" : "is-lose"}`}>
            <p className="fmt-result-head">
              {fmtEvent.kind === "challenge" ? "Thử thách ngày" : fmtEvent.format === "draft" ? "Draft Arena" : "Sealed"}
              {" — "}
              {fmtEvent.win ? `Thắng sau ${fmtEvent.rounds} hiệp!` : `Thua sau ${fmtEvent.rounds} hiệp.`}
              {fmtEvent.coins > 0 ? ` +${fmt(fmtEvent.coins)} Coins` : ""}
              {fmtEvent.shards > 0 ? ` · +${fmtEvent.shards} Mảnh thẻ` : ""}
              {fmtEvent.kind === "challenge" && fmtEvent.win && !fmtEvent.rewardClaimed
                ? " · Phần thưởng hôm nay đã nhận rồi"
                : ""}
              {fmtEvent.kind === "fight"
                ? ` · Chuỗi: thắng ${fmtEvent.wins}/${CHAIN_WINS} · thua ${fmtEvent.losses}/2${fmtEvent.runDone ? " · Lượt đã kết thúc" : ""}`
                : ""}
            </p>
            <p className="player-sub">Đối thủ: {fmtEvent.enemyNames.join(", ")}</p>
            <div className="fmt-log">
              {fmtEvent.log.map((line, i) => (
                <p key={i}>{line}</p>
              ))}
            </div>
          </div>
        ) : null}

        <div className="fmt-grid">
          <div className="fmt-card">
            <h3>Thử thách ngày</h3>
            <p className="player-sub">
              Đội máy cố định của hôm nay, mạnh hơn đội bạn một chút. Thắng nhận
              200 Coins + 5 Mảnh thẻ, 1 lần mỗi ngày — thua đấu lại miễn phí cả ngày.
            </p>
            <p className="player-sub">
              {draftView?.challengeRewardTaken
                ? "Phần thưởng hôm nay: đã nhận."
                : "Phần thưởng hôm nay: chưa nhận."}
            </p>
            <form method="post" action="/api/me/formats" className="gacha-actions">
              <input type="hidden" name="action" value="challenge" />
              <button type="submit" className="player-btn">Đấu thử thách</button>
            </form>
          </div>

          <FormatRunCard title="Draft Arena" format="draft" view={draftView} />
          <FormatRunCard title="Sealed" format="sealed" view={sealedView} />
        </div>
      </section>
    </div>
  );
}

function SpeciesFigure({ sp }: { sp: SpeciesView }) {
  return (
    <figure className="battle-card">
      <CardArt src={sp.spriteUrl} alt={sp.name} rarity={sp.rarity} />
      <figcaption>{sp.name} · {fmt(sp.power)}</figcaption>
    </figure>
  );
}

function FormatRunCard({
  title,
  format,
  view,
}: {
  title: string;
  format: "draft" | "sealed";
  view: FormatView | null;
}) {
  if (!view) {
    return (
      <div className="fmt-card">
        <h3>{title}</h3>
        <p className="player-sub">Đang tải trạng thái…</p>
      </div>
    );
  }
  const run = view.run;
  return (
    <div className="fmt-card">
      <h3>{title}</h3>
      {!run ? (
        <>
          <p className="player-sub">
            {format === "draft"
              ? "Chọn 1-trong-3 qua 8 vòng, 5 lá mạnh nhất ra trận đấu chuỗi: thắng 3 trận hoặc thua 2 trận là hết lượt. Thưởng mỗi trận thắng: 150 / 220 / 320 Coins, thắng trận 3 thêm 10 Mảnh."
              : "Mở pool 30 lá tại chỗ, 5 lá mạnh nhất ra trận đấu chuỗi: thắng 3 trận hoặc thua 2 trận là hết lượt. Thưởng mỗi trận thắng: 150 / 220 / 320 Coins, thắng trận 3 thêm 10 Mảnh."}
          </p>
          <p className="player-sub">
            {view.freeAvailable
              ? "Lượt miễn phí hôm nay: còn."
              : `Lượt miễn phí hôm nay đã dùng — vào lượt mới tốn ${fmt(view.entryFee)} Coins.`}
          </p>
          <form method="post" action="/api/me/formats" className="gacha-actions">
            <input type="hidden" name="action" value="start" />
            <input type="hidden" name="format" value={format} />
            <button type="submit" className="player-btn">
              {view.freeAvailable ? "Vào lượt miễn phí" : `Vào lượt (${fmt(view.entryFee)} Coins)`}
            </button>
          </form>
        </>
      ) : run.phase === "draft" ? (
        <>
          <p className="player-sub">
            Vòng chọn {run.round}/8 — bấm vào 1 lá để chọn. Đã chọn:{" "}
            {run.roster.length ? run.roster.map((s) => s.name).join(", ") : "chưa có"}
          </p>
          <div className="fmt-offers">
            {run.offers.map((sp, i) => (
              <form method="post" action="/api/me/formats" key={sp.id} className="fmt-offer-form">
                <input type="hidden" name="action" value="pick" />
                <input type="hidden" name="format" value="draft" />
                <input type="hidden" name="pick" value={i + 1} />
                <button type="submit" className="fmt-offer-btn" aria-label={`Chọn ${sp.name}`}>
                  <SpeciesFigure sp={sp} />
                </button>
              </form>
            ))}
          </div>
        </>
      ) : (
        <>
          <p className="player-sub">
            Chuỗi đấu: thắng {run.wins}/{CHAIN_WINS} · thua {run.losses}/2
            {format === "sealed" && run.poolCount ? ` · Pool ${run.poolCount} lá` : ""}
          </p>
          {format === "sealed" && run.poolTop.length ? (
            <p className="player-sub">
              Lá mạnh nhất pool: {run.poolTop.map((s) => s.name).join(", ")}
            </p>
          ) : null}
          <div className="arena-row versus-row">
            {run.field.map((sp) => (
              <SpeciesFigure key={sp.id} sp={sp} />
            ))}
          </div>
          <form method="post" action="/api/me/formats" className="gacha-actions">
            <input type="hidden" name="action" value="fight" />
            <input type="hidden" name="format" value={format} />
            <button type="submit" className="player-btn">Đấu trận kế</button>
          </form>
        </>
      )}
    </div>
  );
}
