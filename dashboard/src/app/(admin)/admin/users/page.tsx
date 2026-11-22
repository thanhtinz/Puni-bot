import { adminGate } from "@/lib/current-session";
import { getBotConfig, getUserEconomy, getUserEconomyTotals, getUserMembership, listRecentLedger, type LedgerRow } from "@/lib/db";
import { normalizeMembershipTiers } from "@/lib/membership";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

const fmt = (n: number) => n.toLocaleString("vi-VN");

function LedgerTable({ rows, currencyName }: { rows: LedgerRow[]; currencyName: string }) {
  if (rows.length === 0) return <p>Chưa có giao dịch nào.</p>;
  return (
    <table className="plain">
      <thead>
        <tr>
          <th>Thời gian</th>
          <th>Discord ID</th>
          <th>Thay đổi</th>
          <th>Số dư sau</th>
          <th>Nguồn</th>
          <th>Ghi chú</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r.id}>
            <td>{new Date(r.created_at).toLocaleString("vi-VN")}</td>
            <td>{r.user_id}</td>
            <td style={{ color: r.delta >= 0 ? "#1d9e75" : "#c2452d", fontWeight: 700 }}>
              {r.delta >= 0 ? "+" : "−"}
              {fmt(Math.abs(r.delta))} {currencyName}
            </td>
            <td>
              {fmt(r.balance_after)} {currencyName}
            </td>
            <td>{r.source}</td>
            <td>{r.note ?? ""}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<{ u?: string; saved?: string; err?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { u, saved, err, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const ecoCfg = await getBotConfig<{ currencyName?: string }>("economy").catch(() => null);
  const currencyName = ecoCfg?.currencyName || "Coins";
  const userId = (u ?? "").trim();
  const userEco = userId ? await getUserEconomy(userId).catch(() => null) : null;
  const userTotals = userId ? await getUserEconomyTotals(userId).catch(() => null) : null;
  const userMembership = userId ? await getUserMembership(userId).catch(() => null) : null;
  const tiers = normalizeMembershipTiers(await getBotConfig("membership_tiers").catch(() => null));
  const membershipLabel = userMembership
    ? `${tiers.find((x) => x.id === userMembership.tier_id)?.name ?? userMembership.tier_id} — ${
        userMembership.active
          ? `còn hạn đến ${new Date(userMembership.expires_at).toLocaleDateString("vi-VN")}`
          : `đã hết hạn ${new Date(userMembership.expires_at).toLocaleDateString("vi-VN")}`
      }`
    : "Không phải hội viên";
  const recent = userEco ? null : await listRecentLedger(50).catch(() => null);

  return (
    <>
      <h1>Người dùng &amp; số dư</h1>
      {saved ? <div className="notice ok">Đã điều chỉnh số dư — giao dịch đã ghi vào sổ cái (nguồn: admin).</div> : null}
      {err ? <div className="notice">Không điều chỉnh được: {err}</div> : null}

      <div className="panel">
        <h2>Tìm người dùng</h2>
        <form action="/admin/users" method="get" style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
          <input
            name="u"
            type="text"
            placeholder="Discord ID, ví dụ 847746890808164383"
            defaultValue={userId}
            style={{ minWidth: 320 }}
          />
          <button className="btn" type="submit">
            Tìm
          </button>
        </form>
        {userId && userEco ? (
          <>
            <p style={{ marginTop: 16 }}>
              Số dư hiện tại của <strong>{userId}</strong>:{" "}
              <strong>
                {fmt(userEco.balance)} {currencyName}
              </strong>
            </p>
            {userTotals ? (
              <p>
                Tổng đã nhận: <strong>{fmt(userTotals.earned)} {currencyName}</strong> · Tổng đã
                chi: <strong>{fmt(userTotals.spent)} {currencyName}</strong> · {fmt(userTotals.tx)}{" "}
                giao dịch trong sổ cái
              </p>
            ) : null}
            <p>
              Hội viên: <strong>{membershipLabel}</strong>
            </p>
            <form action="/api/admin/users/adjust" method="post">
              <input type="hidden" name="user_id" value={userId} />
              <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor="mode">Thao tác</label>
                  <select id="mode" name="mode">
                    <option value="add">Cộng tiền</option>
                    <option value="sub">Trừ tiền</option>
                  </select>
                </div>
                <div className="field" style={{ margin: 0 }}>
                  <label htmlFor="amount">Số tiền</label>
                  <input id="amount" name="amount" type="number" min={1} max={100000000} required style={{ maxWidth: 180 }} />
                </div>
                <div className="field" style={{ margin: 0, flex: 1, minWidth: 220 }}>
                  <label htmlFor="note">Lý do (ghi vào sổ cái)</label>
                  <input id="note" name="note" type="text" maxLength={200} placeholder="Ví dụ: bồi thường sự cố, thưởng sự kiện…" />
                </div>
                <button className="btn" type="submit">
                  Thực hiện
                </button>
              </div>
              <p className="hint">
                Mọi điều chỉnh đều ghi sổ cái với nguồn "admin" và lý do ở trên — không sửa
                số dư trực tiếp ngoài sổ. Trừ tiền không cho phép số dư âm.
              </p>
            </form>
          </>
        ) : null}
        {userId && !userEco ? <p>Không đọc được dữ liệu của người dùng này.</p> : null}
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>{userEco ? `Lịch sử giao dịch của ${userId}` : "Giao dịch gần nhất toàn hệ thống"}</h2>
        {userEco ? (
          <LedgerTable rows={userEco.ledger} currencyName={currencyName} />
        ) : recent ? (
          <LedgerTable rows={recent} currencyName={currencyName} />
        ) : (
          <p>Chưa đọc được sổ cái.</p>
        )}
      </div>
    </>
  );
}
