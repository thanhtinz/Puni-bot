import { adminGate } from "@/lib/current-session";
import { db, getEconomyChart, getEconomyStats, getHeartbeats, listConfiguredGuildIds, listMemberships } from "@/lib/db";
import { IconActivity, IconChart, IconCoins, IconServer, IconSpark, IconUsers, IconWallet } from "@/components/icons";

const SOURCE_LABELS: Record<string, string> = {
  daily: "Điểm danh (daily)",
  transfer: "Chuyển tiền",
  pay: "Chuyển tiền",
  game: "Minigame",
  admin: "Quản trị cộng/trừ",
};
import VerifyForm from "./verify-form";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string }>;
}) {
  const gate = await adminGate();
  const { verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null; // layout already explains no-session / not-owner
  }
  const guildIds = await listConfiguredGuildIds().catch(() => [] as string[]);
  const heartbeats = await getHeartbeats().catch(() => null);
  let economyAccounts = 0;
  try {
    const res = await db().query<{ n: string }>(`SELECT COUNT(*)::text AS n FROM economy_accounts`);
    economyAccounts = Number.parseInt(res.rows[0]?.n || "0", 10);
  } catch {
    economyAccounts = 0;
  }
  const alive = (heartbeats ?? []).filter(
    (h) => Date.now() - new Date(h.updated_at).getTime() < 30_000,
  ).length;
  const ecoStats = await getEconomyStats().catch(() => null);
  const ecoChart = await getEconomyChart().catch(() => null);
  const memberships = await listMemberships().catch(() => null);
  const activeMembers = (memberships ?? []).filter((m) => m.active).length;
  const fmt = (n: number) => n.toLocaleString("vi-VN");
  return (
    <>
      <h1>Tổng quan hệ thống</h1>
      {!gate.secondFactorConfigured && (
        <div className="notice">
          Lớp bảo vệ thứ hai của Admin panel CHƯA được cấu hình (ADMIN_PANEL_PASSWORD_SHA256 /
          OWNER_TOTP_SECRET). Hiện tại chỉ có cổng Discord ID chủ bot đang chặn.
        </div>
      )}
      <div className="cards">
        <div className="card">
          <span className="stat-ico"><IconServer /></span>
          <h3>{guildIds.length}</h3>
          <p>Server đã có cấu hình (guild_settings)</p>
        </div>
        <div className="card">
          <span className="stat-ico"><IconUsers /></span>
          <h3>{economyAccounts}</h3>
          <p>Tài khoản economy toàn hệ thống</p>
        </div>
        <div className="card">
          <span className="stat-ico"><IconActivity /></span>
          <h3>
            {alive}/{(heartbeats ?? []).length}
          </h3>
          <p>Shard đang sống / tổng shard có nhịp tim</p>
        </div>
        {ecoStats ? (
          <>
            <div className="card">
              <span className="stat-ico"><IconCoins /></span>
              <h3>{fmt(ecoStats.circulating)}</h3>
              <p>Coins đang lưu hành toàn hệ thống</p>
            </div>
            <div className="card">
              <span className="stat-ico"><IconChart /></span>
              <h3>
                +{fmt(ecoStats.mintedToday)} / −{fmt(ecoStats.burnedToday)}
              </h3>
              <p>Phát hành / thu hồi hôm nay</p>
            </div>
            <div className="card">
              <span className="stat-ico"><IconWallet /></span>
              <h3>{fmt(ecoStats.ledger24h)}</h3>
              <p>Giao dịch economy trong 24 giờ qua</p>
            </div>
            <div className="card">
              <span className="stat-ico"><IconSpark /></span>
              <h3>{activeMembers}</h3>
              <p>Hội viên Membership còn hạn (xem ở mục Membership)</p>
            </div>
          </>
        ) : null}
      </div>
      {ecoChart && ecoChart.sources.length > 0 ? (
        <>
          <div className="panel" style={{ maxWidth: 980 }}>
            <h2>Hoạt động economy — 14 ngày gần nhất</h2>
            <div className="chart-bars">
              {ecoChart.days.map((d) => {
                const max = Math.max(...ecoChart.days.map((x) => x.tx), 1);
                return (
                  <div className="chart-col" key={d.day}>
                    <span className="cv">{d.tx > 0 ? d.tx : ""}</span>
                    <div
                      className="chart-bar"
                      style={{ height: `${Math.max((d.tx / max) * 100, d.tx > 0 ? 6 : 2)}%` }}
                      title={`${d.day}: ${d.tx} giao dịch, phát hành ${d.minted}, thu hồi ${d.burned}`}
                    />
                    <span className="cl">{d.day.slice(8, 10)}/{d.day.slice(5, 7)}</span>
                  </div>
                );
              })}
            </div>
            <p style={{ marginBottom: 0 }}>
              Tổng 14 ngày: {fmt(ecoChart.days.reduce((a, d) => a + d.tx, 0))} giao dịch ·
              phát hành {fmt(ecoChart.days.reduce((a, d) => a + d.minted, 0))} · thu hồi{" "}
              {fmt(ecoChart.days.reduce((a, d) => a + d.burned, 0))}
            </p>
          </div>
          <div className="panel" style={{ maxWidth: 980 }}>
            <h2>Cơ cấu theo nguồn tiền</h2>
            {ecoChart.sources.map((s) => {
              const max = Math.max(...ecoChart.sources.map((x) => x.tx), 1);
              return (
                <div className="src-row" key={s.source}>
                  <span className="sn">{SOURCE_LABELS[s.source] ?? s.source}</span>
                  <div className="src-track">
                    <div className="src-fill" style={{ width: `${(s.tx / max) * 100}%` }} />
                  </div>
                  <span className="sv">{fmt(s.tx)} giao dịch</span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </>
  );
}
