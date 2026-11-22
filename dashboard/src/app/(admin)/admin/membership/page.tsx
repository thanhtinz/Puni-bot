import { adminGate } from "@/lib/current-session";
import { getBotConfig, getSiteSetting, listMembershipOrders, listMemberships } from "@/lib/db";
import { normalizeMembershipTiers, type MembershipTier } from "@/lib/membership";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

const SLOT_COUNT = 4;

function TierSlot({ index, tier }: { index: number; tier?: MembershipTier }) {
  const p = `t${index}_`;
  return (
    <div className="panel" style={{ marginBottom: 16 }}>
      <h2>Gói {index + 1}{tier ? ` — ${tier.name}` : " (trống)"}</h2>
      <input type="hidden" name={`${p}id`} value={tier?.id ?? ""} />
      <div className="field">
        <label htmlFor={`${p}name`}>Tên gói (để trống = tắt gói này)</label>
        <input id={`${p}name`} name={`${p}name`} type="text" defaultValue={tier?.name ?? ""} maxLength={40} style={{ maxWidth: 320 }} />
      </div>
      <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${p}price`}>Nhãn giá hiển thị</label>
          <input id={`${p}price`} name={`${p}price`} type="text" defaultValue={tier?.priceLabel ?? ""} maxLength={40} placeholder="25.000đ/tháng" style={{ maxWidth: 200 }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${p}amount`}>Giá bán (VNĐ, 0 = không bán online)</label>
          <input id={`${p}amount`} name={`${p}amount`} type="number" min={0} max={100000000} defaultValue={tier?.priceAmount ?? 0} style={{ maxWidth: 170 }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${p}bonus`}>% cộng thêm daily</label>
          <input id={`${p}bonus`} name={`${p}bonus`} type="number" min={0} max={300} defaultValue={tier?.dailyBonusPercent ?? 0} style={{ maxWidth: 110 }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${p}teams`}>Đội hình + (game)</label>
          <input id={`${p}teams`} name={`${p}teams`} type="number" min={0} max={5} defaultValue={tier?.extraTeams ?? 0} style={{ maxWidth: 110 }} />
        </div>
        <div className="field" style={{ margin: 0 }}>
          <label htmlFor={`${p}loot`}>Lootbox +/ngày (game)</label>
          <input id={`${p}loot`} name={`${p}loot`} type="number" min={0} max={5} defaultValue={tier?.extraLootboxPerDay ?? 0} style={{ maxWidth: 110 }} />
        </div>
      </div>
      <label className="check" style={{ marginTop: 12 }}>
        <input type="checkbox" name={`${p}pets`} defaultChecked={tier?.exclusivePets ?? false} />
        <span>Mở khoá pet độc quyền (game)</span>
      </label>
      <div className="field" style={{ marginTop: 10 }}>
        <label htmlFor={`${p}perks`}>Quyền lợi hiển thị (mỗi dòng một ý)</label>
        <textarea id={`${p}perks`} name={`${p}perks`} rows={4} maxLength={1000} defaultValue={(tier?.perks ?? []).join("\n")} style={{ maxWidth: 640 }} />
      </div>
    </div>
  );
}

export default async function AdminMembershipPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; granted?: string; err?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { saved, granted, err, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const tiers = normalizeMembershipTiers(await getBotConfig("membership_tiers").catch(() => null));
  const joinUrl = (await getSiteSetting("membership_url").catch(() => null)) ?? "";
  const members = await listMemberships().catch(() => null);
  const orders = await listMembershipOrders(50).catch(() => null);
  const roleId = await getBotConfig<string>("membership_role_id").catch(() => null);
  const [payBin, payAcc, payName] = await Promise.all([
    getSiteSetting("pay_bank_bin").catch(() => null),
    getSiteSetting("pay_account_no").catch(() => null),
    getSiteSetting("pay_account_name").catch(() => null),
  ]);
  const fmtVnd = (n: string) => Number.parseInt(n, 10).toLocaleString("vi-VN") + "đ";
  const ORDER_STATUS: Record<string, string> = {
    pending: "Chờ thanh toán",
    paid: "Đã thanh toán",
    cancelled: "Đã huỷ",
  };
  const tierName = (id: string) => tiers.find((t) => t.id === id)?.name ?? id;
  const activeCount = (members ?? []).filter((m) => m.active).length;

  return (
    <>
      <h1>Membership — gói hội viên</h1>
      {saved ? <div className="notice ok">Đã lưu gói — bot và trang Hội viên áp dụng ngay.</div> : null}
      {granted ? <div className="notice ok">Đã cấp/gia hạn hội viên.</div> : null}
      {err ? <div className="notice">Không thực hiện được: {err}</div> : null}

      <div className="cards" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>{tiers.length}</h3>
          <p>Gói đang mở bán/cấp</p>
        </div>
        <div className="card">
          <h3>{activeCount}</h3>
          <p>Hội viên còn hạn</p>
        </div>
        <div className="card">
          <h3>{(members ?? []).length}</h3>
          <p>Tổng hồ sơ hội viên (kể cả đã hết hạn)</p>
        </div>
      </div>

      <form action="/api/admin/membership/tiers" method="post">
        {Array.from({ length: SLOT_COUNT }, (_, i) => (
          <TierSlot key={i} index={i} tier={tiers[i]} />
        ))}
        <div className="panel">
          <h2>Link đăng ký / ủng hộ</h2>
          <p>
            Nút "Đăng ký" ở trang Hội viên công khai trỏ tới link này (ví dụ trang
            Patreon của bạn). Chỉ nhận link https:// — để trống thì trang Hội viên
            hướng dẫn khách vào kênh Support.
          </p>
          <div className="field">
            <label htmlFor="membership_url">Link đăng ký</label>
            <input id="membership_url" name="membership_url" type="text" defaultValue={joinUrl} placeholder="https://www.patreon.com/..." style={{ maxWidth: 560 }} />
          </div>
          <button className="btn" type="submit">
            Lưu tất cả gói
          </button>
        </div>
      </form>

      <div className="panel">
        <h2>Cấp / gia hạn hội viên</h2>
        <p>
          Cấp tay sau khi đối soát thanh toán ngoài (Patreon, chuyển khoản…). Gia
          hạn cộng dồn từ hạn hiện tại nếu còn hạn — người dùng không mất ngày đã trả.
        </p>
        <form action="/api/admin/membership/grant" method="post">
          <input type="hidden" name="action" value="grant" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="user_id">Discord ID</label>
              <input id="user_id" name="user_id" type="text" required style={{ minWidth: 220 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="tier_id">Gói</label>
              <select id="tier_id" name="tier_id">
                {tiers.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="days">Số ngày</label>
              <input id="days" name="days" type="number" min={1} max={3650} defaultValue={30} required style={{ maxWidth: 110 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="source">Nguồn</label>
              <input id="source" name="source" type="text" defaultValue="manual" maxLength={40} style={{ maxWidth: 140 }} />
            </div>
            <div className="field" style={{ margin: 0, flex: 1, minWidth: 180 }}>
              <label htmlFor="note">Ghi chú</label>
              <input id="note" name="note" type="text" maxLength={200} />
            </div>
            <button className="btn" type="submit">
              Cấp hội viên
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Role màu cho hội viên (server chính)</h2>
        <p>
          Dán Role ID của role hội viên trong server chính của Puni — bot tự cấp
          role cho hội viên còn hạn và tự thu hồi khi hết hạn (kiểm tra mỗi 10
          phút). Để trống = tắt quyền lợi này. Role của bot phải nằm TRÊN role
          hội viên trong danh sách role của server thì mới cấp được.
        </p>
        <form action="/api/admin/membership/role" method="post">
          <div className="field" style={{ margin: 0 }}>
            <label htmlFor="role_id">Role ID</label>
            <input id="role_id" name="role_id" type="text" defaultValue={roleId ?? ""} placeholder="Ví dụ: 1505404647924564999" style={{ width: 320 }} />
          </div>
          <div style={{ marginTop: 12 }}>
            <button className="btn" type="submit">
              Lưu Role ID
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Thanh toán QR — tài khoản nhận tiền</h2>
        <p>
          Khách mua gói ngay tại trang Hội viên: chọn gói, nhập Discord ID, web
          hiện mã VietQR đúng số tiền với nội dung chuyển khoản là mã đơn. Điền cả
          3 ô để mở bán; xoá trắng cả 3 để tắt bán trực tuyến.
        </p>
        <form action="/api/admin/membership/payment" method="post">
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="pay_bank_bin">Mã ngân hàng (BIN, 6 số)</label>
              <input id="pay_bank_bin" name="pay_bank_bin" type="text" defaultValue={payBin ?? ""} placeholder="970436" style={{ width: 150 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="pay_account_no">Số tài khoản</label>
              <input id="pay_account_no" name="pay_account_no" type="text" defaultValue={payAcc ?? ""} style={{ width: 200 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="pay_account_name">Tên chủ tài khoản</label>
              <input id="pay_account_name" name="pay_account_name" type="text" defaultValue={payName ?? ""} style={{ width: 240 }} />
            </div>
          </div>
          <p style={{ marginTop: 10 }}>
            BIN tra theo ngân hàng: Vietcombank 970436 · MB Bank 970422 · Techcombank
            970407 · ACB 970416 · VietinBank 970415 · BIDV 970418 · Sacombank 970403 ·
            VPBank 970432 · TPBank 970423.
          </p>
          <button className="btn" type="submit">
            Lưu tài khoản nhận tiền
          </button>
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Đơn mua gói gần nhất</h2>
        <p>
          Đối soát tiền vào trong app ngân hàng theo nội dung chuyển khoản (mã
          đơn) rồi bấm Xác nhận — hội viên kích hoạt ngay cho Discord ID của đơn.
          Đơn chờ quá 24 giờ tự coi là hết hạn.
        </p>
        {orders && orders.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Mã đơn</th>
                <th>Discord ID</th>
                <th>Gói</th>
                <th>Số tiền</th>
                <th>Trạng thái</th>
                <th>Tạo lúc</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => (
                <tr key={o.code}>
                  <td>{o.code}</td>
                  <td>{o.user_id}</td>
                  <td>{o.tier_name}</td>
                  <td>{fmtVnd(o.amount)}</td>
                  <td>{o.expired ? "Hết hạn" : (ORDER_STATUS[o.status] ?? o.status)}</td>
                  <td>{new Date(o.created_at).toLocaleString("vi-VN")}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    {o.status === "pending" && !o.expired ? (
                      <>
                        <form action="/api/admin/membership/orders" method="post" style={{ display: "inline" }}>
                          <input type="hidden" name="action" value="confirm" />
                          <input type="hidden" name="code" value={o.code} />
                          <button className="btn sm" type="submit">
                            Xác nhận đã trả
                          </button>
                        </form>{" "}
                        <form action="/api/admin/membership/orders" method="post" style={{ display: "inline" }}>
                          <input type="hidden" name="action" value="cancel" />
                          <input type="hidden" name="code" value={o.code} />
                          <button className="btn secondary sm" type="submit">
                            Huỷ
                          </button>
                        </form>
                      </>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Chưa có đơn mua nào.</p>
        )}
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Danh sách hội viên</h2>
        {members && members.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Discord ID</th>
                <th>Gói</th>
                <th>Hết hạn</th>
                <th>Trạng thái</th>
                <th>Nguồn</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {members.map((m) => (
                <tr key={m.user_id}>
                  <td>{m.user_id}</td>
                  <td>{tierName(m.tier_id)}</td>
                  <td>{new Date(m.expires_at).toLocaleDateString("vi-VN")}</td>
                  <td>{m.active ? "Còn hạn" : "Hết hạn"}</td>
                  <td>{m.source}</td>
                  <td>
                    <form action="/api/admin/membership/grant" method="post">
                      <input type="hidden" name="action" value="revoke" />
                      <input type="hidden" name="user_id" value={m.user_id} />
                      <button className="btn secondary sm" type="submit">
                        Thu hồi
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Chưa có hội viên nào.</p>
        )}
      </div>
    </>
  );
}
