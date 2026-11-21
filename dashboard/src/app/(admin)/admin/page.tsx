import { adminGate } from "@/lib/current-session";
import { db, getEconomyStats, getHeartbeats, listConfiguredGuildIds } from "@/lib/db";
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
          <h3>{guildIds.length}</h3>
          <p>Server đã có cấu hình (guild_settings)</p>
        </div>
        <div className="card">
          <h3>{economyAccounts}</h3>
          <p>Tài khoản economy toàn hệ thống</p>
        </div>
        <div className="card">
          <h3>
            {alive}/{(heartbeats ?? []).length}
          </h3>
          <p>Shard đang sống / tổng shard có nhịp tim</p>
        </div>
        {ecoStats ? (
          <>
            <div className="card">
              <h3>{fmt(ecoStats.circulating)}</h3>
              <p>Coins đang lưu hành toàn hệ thống</p>
            </div>
            <div className="card">
              <h3>
                +{fmt(ecoStats.mintedToday)} / −{fmt(ecoStats.burnedToday)}
              </h3>
              <p>Phát hành / thu hồi hôm nay</p>
            </div>
            <div className="card">
              <h3>{fmt(ecoStats.ledger24h)}</h3>
              <p>Giao dịch economy trong 24 giờ qua</p>
            </div>
          </>
        ) : null}
      </div>
    </>
  );
}
