import { redirect } from "next/navigation";
import { adminGate } from "@/lib/current-session";
import { getBotConfig, getVoteStats, listRecentVotes } from "@/lib/db";
import { normalizeVoteConfig } from "@/lib/vote";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("vi-VN");

export default async function AdminVotePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string }>;
}) {
  const gate = await adminGate();
  if (!gate.ok && gate.reason === "not-owner") redirect("/dashboard");
  if (!gate.ok) redirect("/admin");
  const sp = await searchParams;
  const cfg = normalizeVoteConfig(await getBotConfig("vote_config").catch(() => null));
  const stats = await getVoteStats().catch(() => null);
  const recent = await listRecentVotes(30).catch(() => null);
  const secretSet = Boolean(process.env.TOPGG_WEBHOOK_SECRET);

  return (
    <>
      <h1>Vote — top.gg</h1>
      {sp.saved ? <div className="notice ok">Đã lưu cấu hình vote.</div> : null}
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Người dùng vote cho Puni trên top.gg (mỗi 12 giờ một lần), top.gg gọi
        webhook về web, tiền thưởng cộng thẳng vào ví economy của người vote.
        Mỗi người chỉ được tính một lượt trong mỗi cửa sổ 12 giờ — webhook gửi
        trùng cũng không cộng hai lần.
      </p>

      <div className="cards" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>{stats ? fmt(stats.total) : "—"}</h3>
          <p>Tổng lượt vote đã tính</p>
        </div>
        <div className="card">
          <h3>{stats ? fmt(stats.today) : "—"}</h3>
          <p>Vote hôm nay</p>
        </div>
        <div className="card">
          <h3>{stats ? fmt(stats.earned) : "—"}</h3>
          <p>Tổng tiền đã phát từ vote</p>
        </div>
      </div>

      <div className="panel">
        <h2>Cấu hình thưởng</h2>
        <form action="/api/admin/vote" method="post">
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} />
            <span>Bật hệ thống vote</span>
          </label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="reward">Tiền thưởng mỗi lượt vote</label>
              <input id="reward" name="reward" type="number" min={0} max={1000000} defaultValue={cfg.rewardPerVote} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="weekend_multiplier">Nhân cuối tuần (top.gg tính vote đôi)</label>
              <input id="weekend_multiplier" name="weekend_multiplier" type="number" min={1} max={10} defaultValue={cfg.weekendMultiplier} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="member_multiplier">Nhân cho hội viên (từ gói 2 trở lên)</label>
              <input id="member_multiplier" name="member_multiplier" type="number" min={1} max={10} defaultValue={cfg.memberMultiplier} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="vote_url">Link vote (để trống = tự suy ra từ ID bot trên top.gg)</label>
            <input id="vote_url" name="vote_url" type="text" defaultValue={cfg.voteUrl} placeholder="https://top.gg/bot/..." style={{ maxWidth: 560 }} />
          </div>
          <button className="btn" type="submit">
            Lưu cấu hình vote
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Nối top.gg</h2>
        <p>
          Trên trang quản lý bot ở top.gg (mục Webhooks), điền Webhook URL là{" "}
          <strong>/api/votes/topgg</strong> của tên miền web này (ví dụ
          https://discord.bntshop.com/api/votes/topgg) và đặt Webhook
          Authorization trùng với biến môi trường TOPGG_WEBHOOK_SECRET của web.
        </p>
        <p>
          Trạng thái khoá bí mật webhook:{" "}
          <strong>{secretSet ? "Đã đặt (TOPGG_WEBHOOK_SECRET)" : "CHƯA đặt — webhook đang khoá, vote sẽ không được tính"}</strong>
        </p>
        <p>
          Người dùng xem link vote và lịch sử vote của mình bằng lệnh /vote
          trong Discord. Thưởng vote cộng dồn được với hệ số cuối tuần và hệ số
          hội viên (ví dụ mặc định: 100 gốc → cuối tuần 200 → hội viên gói 2
          ngày cuối tuần 400).
        </p>
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Lượt vote gần nhất</h2>
        {recent && recent.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Discord ID</th>
                <th>Thưởng</th>
                <th>Cuối tuần</th>
                <th>Thời gian</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((v, i) => (
                <tr key={i}>
                  <td>{v.user_id}</td>
                  <td>{fmt(Number.parseInt(v.reward, 10))}</td>
                  <td>{v.is_weekend ? "Có" : "—"}</td>
                  <td>{new Date(v.created_at).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Chưa có lượt vote nào được tính (hoặc bảng vote_events chưa được tạo — chạy migration 0014).</p>
        )}
      </div>
    </>
  );
}
