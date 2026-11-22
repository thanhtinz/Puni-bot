import { currentSession } from "@/lib/current-session";
import { questView } from "@/lib/quests";
import { QUEST_BONUS_COINS, QUEST_BONUS_SHARDS } from "@/lib/quest-defs";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Nhiệm vụ ngày TCG (spec 6.38): 5 nhiệm vụ mỗi ngày, cùng danh sách
 * cho mọi người chơi, tiến độ chạy chung với bot Discord — làm ở đâu
 * cũng tính, nhận thưởng ở đâu cũng được.
 */
export default async function MeQuestsPage({
  searchParams,
}: {
  searchParams: Promise<{ err?: string; msg?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const view = await questView(session.userId).catch(() => null);

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Nhiệm vụ ngày</h1>
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      <p className="player-sub">
        5 nhiệm vụ mới mỗi ngày — làm trên web hay trong Discord đều tính chung.
        Xong cả 5 nhận thêm {fmt(QUEST_BONUS_COINS)} Coins + {QUEST_BONUS_SHARDS} Mảnh thẻ
        {view?.bonusClaimed ? " (hôm nay đã nhận thưởng hoàn thành)" : ""}.
      </p>

      {!view ? (
        <p className="player-notice err">Chưa tải được nhiệm vụ, thử lại sau.</p>
      ) : (
        <>
          {view.rows.some((r) => r.done && !r.claimed) ? (
            <form method="post" action="/api/me/quests" className="gacha-actions">
              <input type="hidden" name="action" value="claimall" />
              <button type="submit" className="player-btn">Nhận tất cả thưởng đã xong</button>
            </form>
          ) : null}
          <div className="quest-list">
            {view.rows.map((r) => (
              <div className="quest-row" key={r.id}>
                <div className="quest-main">
                  <p className="quest-name">
                    {r.name}
                    {r.claimed ? <span className="quest-state">Đã nhận</span> : r.done ? <span className="quest-state is-done">Đã xong</span> : null}
                  </p>
                  <div className="quest-bar" role="progressbar" aria-valuenow={r.progress} aria-valuemax={r.target}>
                    <span style={{ width: `${Math.min(100, (r.progress / r.target) * 100)}%` }} />
                  </div>
                  <p className="player-sub">
                    Tiến độ {r.progress}/{r.target} · Thưởng:{" "}
                    {[r.coins ? `${fmt(r.coins)} Coins` : "", r.shards ? `${r.shards} Mảnh thẻ` : ""]
                      .filter(Boolean)
                      .join(" + ")}
                  </p>
                </div>
                {r.done && !r.claimed ? (
                  <form method="post" action="/api/me/quests">
                    <input type="hidden" name="action" value="claim" />
                    <input type="hidden" name="questId" value={r.id} />
                    <button type="submit" className="player-btn">Nhận thưởng</button>
                  </form>
                ) : null}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
