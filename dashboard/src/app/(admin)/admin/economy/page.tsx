import { adminGate } from "@/lib/current-session";
import { getBotConfig, getEconomyStats } from "@/lib/db";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

interface EconomyConfig {
  currencyName: string;
  gemsName: string;
  dailyBase: number;
  dailyStreakBonus: number;
  dailyStreakBonusCap: number;
}

const DEFAULTS: EconomyConfig = {
  currencyName: "Coins",
  gemsName: "Gems",
  dailyBase: 100,
  dailyStreakBonus: 10,
  dailyStreakBonusCap: 100,
};

const fmt = (n: number) => n.toLocaleString("vi-VN");

export default async function AdminEconomyPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { saved, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const stored = await getBotConfig<EconomyConfig>("economy").catch(() => null);
  const cfg: EconomyConfig = { ...DEFAULTS, ...(stored ?? {}) };
  const stats = await getEconomyStats().catch(() => null);
  return (
    <>
      <h1>Economy toàn hệ thống</h1>
      {saved ? <div className="notice ok">Đã lưu cấu hình economy — bot áp dụng trong tối đa 30 giây, không cần khởi động lại (riêng tên tiền hiển thị theo bản bot đang chạy, đổi tên có hiệu lực đầy đủ sau khi bot khởi động lại).</div> : null}
      {stats ? (
        <div className="cards" style={{ marginBottom: 20 }}>
          <div className="card">
            <h3>{fmt(stats.circulating)}</h3>
            <p>{cfg.currencyName} đang lưu hành (tổng số dư mọi tài khoản)</p>
          </div>
          <div className="card">
            <h3>{fmt(stats.accounts)}</h3>
            <p>Tài khoản economy toàn hệ thống</p>
          </div>
          <div className="card">
            <h3>+{fmt(stats.mintedToday)} / −{fmt(stats.burnedToday)}</h3>
            <p>Phát hành / thu hồi hôm nay (theo sổ cái)</p>
          </div>
          <div className="card">
            <h3>{fmt(stats.ledger24h)}</h3>
            <p>Giao dịch trong 24 giờ qua</p>
          </div>
        </div>
      ) : null}
      <div className="panel">
        <h2>Thông số tiền tệ</h2>
        <p>
          Áp dụng cho MỌI server và game (economy là ví cộng đồng toàn cục theo
          Discord ID). Bot tự đọc lại cấu hình mỗi 30 giây.
        </p>
        <form action="/api/admin/economy" method="post">
          <div className="field">
            <label htmlFor="currencyName">Tên tiền</label>
            <input id="currencyName" name="currencyName" type="text" defaultValue={cfg.currencyName} maxLength={24} style={{ maxWidth: 260 }} />
            <div className="hint">Tên hiển thị cạnh số dư, ví dụ Coins.</div>
          </div>
          <div className="field">
            <label htmlFor="gemsName">Tên tiền Gems (trong game)</label>
            <input id="gemsName" name="gemsName" type="text" defaultValue={cfg.gemsName} maxLength={24} style={{ maxWidth: 260 }} />
            <div className="hint">Tên hiển thị cạnh số Gems — luôn hiện cùng lúc với {cfg.currencyName} theo luật hiển thị tiền.</div>
          </div>
          <div className="field">
            <label htmlFor="dailyBase">Daily cơ bản</label>
            <input id="dailyBase" name="dailyBase" type="number" min={0} max={1000000} defaultValue={cfg.dailyBase} style={{ maxWidth: 260 }} />
            <div className="hint">Số tiền nhận khi điểm danh ngày đầu / sau khi đứt chuỗi.</div>
          </div>
          <div className="field">
            <label htmlFor="dailyStreakBonus">Thưởng mỗi ngày streak</label>
            <input id="dailyStreakBonus" name="dailyStreakBonus" type="number" min={0} max={100000} defaultValue={cfg.dailyStreakBonus} style={{ maxWidth: 260 }} />
            <div className="hint">Cộng thêm cho mỗi ngày liên tiếp, tính từ ngày thứ 2.</div>
          </div>
          <div className="field">
            <label htmlFor="dailyStreakBonusCap">Trần thưởng streak</label>
            <input id="dailyStreakBonusCap" name="dailyStreakBonusCap" type="number" min={0} max={1000000} defaultValue={cfg.dailyStreakBonusCap} style={{ maxWidth: 260 }} />
            <div className="hint">Tổng thưởng streak tối đa mỗi lần daily, chống lạm phát.</div>
          </div>
          <button className="btn" type="submit">
            Lưu cấu hình
          </button>
        </form>
      </div>
      {stats && stats.top.length > 0 ? (
        <div className="panel">
          <h2>Top số dư toàn hệ thống</h2>
          <table className="plain">
            <thead>
              <tr>
                <th>Discord ID</th>
                <th>Số dư</th>
              </tr>
            </thead>
            <tbody>
              {stats.top.map((t) => (
                <tr key={t.user_id}>
                  <td>{t.user_id}</td>
                  <td>
                    {fmt(Number.parseInt(t.balance, 10))} {cfg.currencyName}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </>
  );
}
