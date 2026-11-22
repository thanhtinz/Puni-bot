import { redirect } from "next/navigation";
import { currentSession } from "@/lib/current-session";
import { isOwner } from "@/lib/session";
import {
  fmtCoins, getTournamentConfig, getTournamentDetail, listOpenTournaments,
  listPastTournaments, listRunningTournaments, myPastTournamentIds, myRunningTournamentIds,
  roundName, settleTournamentTimeouts, totalRounds,
  TOURNAMENT_WINDOW_MS,
  type MatchRow, type TournamentRow,
} from "@/lib/tournament";

function playerLabel(id: string | null, me: string, seeds: Map<string, number | null>): string {
  if (!id) return "Chưa xác định";
  const seed = seeds.get(id);
  const name = id === me ? "Bạn" : `Người chơi …${id.slice(-6)}`;
  return seed ? `#${seed} ${name}` : name;
}

function MatchCard({ m, t, me, seeds }: { m: MatchRow; t: TournamentRow; me: string; seeds: Map<string, number | null> }) {
  const mine = m.p1Id === me || m.p2Id === me;
  const myIn = m.p1Id === me ? m.p1In : m.p2In;
  const decided = !!m.winnerId;
  let meta: string;
  if (decided) {
    meta = m.result === "battle" ? "Đã đấu" : m.result === "walkover" ? "Xử thắng — đối thủ vắng" : "Cả hai vắng — hạt giống cao đi tiếp";
  } else if (m.readyAt) {
    const leftMs = new Date(m.readyAt).getTime() + TOURNAMENT_WINDOW_MS - Date.now();
    meta = leftMs > 0 ? `Còn ${Math.max(1, Math.ceil(leftMs / 60000))} phút để đấu` : "Đã hết giờ — đang xử walkover";
  } else {
    meta = "Chờ đủ hai người chơi";
  }
  const row = (id: string | null, checkedIn: boolean) => (
    <div className={`trn-prow${m.winnerId && m.winnerId === id ? " win" : ""}`}>
      <span>{playerLabel(id, me, seeds)}</span>
      {m.winnerId && m.winnerId === id ? <span className="trn-tag win">Thắng</span>
        : !decided && id ? <span className={`trn-tag${checkedIn ? " in" : ""}`}>{checkedIn ? "Đã vào trận" : "Chưa vào"}</span>
        : null}
    </div>
  );
  return (
    <div className={`trn-match${mine && !decided ? " mine" : ""}`}>
      {row(m.p1Id, m.p1In)}
      {row(m.p2Id, m.p2In)}
      <div className="trn-meta">{meta}</div>
      {mine && !decided && m.p1Id && m.p2Id ? (
        myIn ? <p className="player-sub">Bạn đã vào trận — chờ đối thủ vào là đánh ngay.</p> : (
          <form method="post" action="/api/me/tournament">
            <input type="hidden" name="action" value="play" />
            <input type="hidden" name="matchId" value={m.id} />
            <button className="player-btn sm" type="submit">Vào trận</button>
          </form>
        )
      ) : null}
      {decided && m.result === "battle" && m.log && m.log.length ? (
        <details className="trn-log">
          <summary>Xem diễn biến trận</summary>
          <div>{m.log.map((line, i) => <p key={i}>{line}</p>)}</div>
        </details>
      ) : null}
      <span hidden>{t.id}</span>
    </div>
  );
}

async function Bracket({ id, me }: { id: number; me: string }) {
  const detail = await getTournamentDetail(id);
  if (!detail) return null;
  const { tournament: t, entries, matches } = detail;
  const seeds = new Map(entries.map((e) => [e.userId, e.seed]));
  const rounds = totalRounds(t.size);
  return (
    <section className="player-panel">
      <h2>{t.name}</h2>
      <p className="player-sub">
        {t.size} người · Quỹ thưởng {fmtCoins(t.size * t.entryFee * (1 - t.rakePercent / 100))} Coins
        {t.championId ? ` · Vô địch: ${playerLabel(t.championId, me, seeds)}` : ""}
      </p>
      <div className="trn-bracket">
        {Array.from({ length: rounds }, (_, i) => i + 1).map((round) => (
          <div className="trn-round" key={round}>
            <h3>{roundName(round, t.size)}</h3>
            {matches.filter((m) => m.round === round).map((m) => (
              <MatchCard key={m.id} m={m} t={t} me={me} seeds={seeds} />
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

export default async function TournamentPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string }>;
}) {
  const session = await currentSession();
  if (!session) redirect("/api/auth/login");
  const sp = await searchParams;
  const me = session.userId;
  await settleTournamentTimeouts();
  const [cfg, open, running, past, myRunning, myPast] = await Promise.all([
    getTournamentConfig(),
    listOpenTournaments(me),
    listRunningTournaments(),
    listPastTournaments(),
    myRunningTournamentIds(me),
    myPastTournamentIds(me),
  ]);
  const owner = isOwner(session);
  const runningOthers = running.filter((t) => !myRunning.includes(t.id));

  return (
    <div className="player-body-inner">
      <h1>Giải đấu thẻ</h1>
      <p className="player-sub">Bracket loại trực tiếp — quá 10 phút không vào trận là xử thua.</p>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}

      {owner ? (
        <section className="player-panel">
          <h2>Tạo giải mới (chủ bot)</h2>
          <form method="post" action="/api/me/tournament" className="trn-create">
            <input type="hidden" name="action" value="create" />
            <label>Tên giải<input name="name" placeholder="Giải đấu Puni" maxLength={80} /></label>
            <label>Số người
              <select name="size" defaultValue={cfg.size}>
                <option value={8}>8 người</option>
                <option value={16}>16 người</option>
              </select>
            </label>
            <label>Phí tham gia (Coins)<input name="entryFee" type="number" min={0} step="any" defaultValue={cfg.entryFee} /></label>
            <label>Rake (%)<input name="rakePercent" type="number" min={0} max={90} step="any" defaultValue={cfg.rakePercent} /></label>
            <label>Hạng 1 (%)<input name="prizeFirst" type="number" min={0} max={100} step="any" defaultValue={cfg.prizeFirst} /></label>
            <label>Hạng 2 (%)<input name="prizeSecond" type="number" min={0} max={100} step="any" defaultValue={cfg.prizeSecond} /></label>
            <label>Hạng 3–4 (%)<input name="prizeSemis" type="number" min={0} max={100} step="any" defaultValue={cfg.prizeSemis} /></label>
            <button className="player-btn" type="submit">Tạo giải</button>
          </form>
        </section>
      ) : null}

      <h2 className="player-h2">Đang mở đăng ký</h2>
      {open.length ? (
        <div className="trn-join-grid">
          {open.map((t) => (
            <section className="player-panel trn-join" key={t.id}>
              <h3>{t.name}</h3>
              <p className="player-sub">
                {t.entrants}/{t.size} người · Phí {fmtCoins(t.entryFee)} Coins · Quỹ thưởng{" "}
                {fmtCoins(t.size * t.entryFee * (1 - t.rakePercent / 100))} Coins
                {t.edition ? <> · Bản {t.edition === "jp" ? "Nhật" : "tiếng Anh"}</> : null}
              </p>
              {t.joined ? (
                <p className="player-notice ok">Đã đăng ký — đủ {t.size} người là bracket tự khoá.</p>
              ) : (
                <form method="post" action="/api/me/tournament">
                  <input type="hidden" name="action" value="join" />
                  <input type="hidden" name="tournamentId" value={t.id} />
                  <button className="player-btn" type="submit">Đăng ký bằng bộ bài đang dùng</button>
                </form>
              )}
              {owner ? (
                <form method="post" action="/api/me/tournament">
                  <input type="hidden" name="action" value="cancel" />
                  <input type="hidden" name="tournamentId" value={t.id} />
                  <button className="player-btn ghost sm" type="submit">Huỷ giải + hoàn phí</button>
                </form>
              ) : null}
            </section>
          ))}
        </div>
      ) : <p className="player-sub">Chưa có giải nào đang mở đăng ký.</p>}

      {myRunning.length ? <h2 className="player-h2">Giải tôi đang đấu</h2> : null}
      {myRunning.map((id) => <Bracket key={id} id={id} me={me} />)}

      {runningOthers.length ? <h2 className="player-h2">Giải đang diễn ra</h2> : null}
      {runningOthers.map((t) => <Bracket key={t.id} id={t.id} me={me} />)}

      <h2 className="player-h2">Lịch sử giải</h2>
      {past.length ? (
        <section className="player-panel">
          {past.map((t) => (
            <p className="trn-history" key={t.id}>
              <strong>{t.name}</strong> · {t.size} người · Vô địch:{" "}
              {t.championId === me ? "Bạn" : t.championId ? `Người chơi …${t.championId.slice(-6)}` : "—"}
              {t.finishedAt ? ` · ${new Date(t.finishedAt).toLocaleDateString("vi-VN")}` : ""}
            </p>
          ))}
        </section>
      ) : <p className="player-sub">Chưa có giải nào kết thúc.</p>}
      {myPast.map((id) => <Bracket key={id} id={id} me={me} />)}
    </div>
  );
}
