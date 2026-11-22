import { adminGate } from "@/lib/current-session";
import { getSiteSetting } from "@/lib/db";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

export default async function AdminWebsitePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { saved, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null; // layout already explains no-session / not-owner
  }
  const supportUrl = (await getSiteSetting("support_url").catch(() => null)) ?? "";
  const coinsSet = Boolean(await getSiteSetting("asset_coins_icon").catch(() => null));
  const gemsSet = Boolean(await getSiteSetting("asset_gems_icon").catch(() => null));
  return (
    <>
      <h1>Trang web công khai</h1>
      {saved ? <div className="notice ok">Đã lưu cấu hình trang web.</div> : null}
      <div className="panel">
        <h2>Kênh Support</h2>
        <p>
          Link mở khi khách bấm <strong>Support</strong> trên menu của trang chủ (mở tab
          mới) — thường là link mời vào kênh support trong server Discord của bạn, dạng{" "}
          <code>https://discord.gg/…</code> hoặc link kênh trực tiếp. Để trống thì menu
          không hiện mục Support.
        </p>
        <form action="/api/admin/website" method="post">
          <div className="field">
            <label htmlFor="support_url">Link Support</label>
            <input
              id="support_url"
              name="support_url"
              type="url"
              placeholder="https://discord.gg/…"
              defaultValue={supportUrl}
              style={{ width: "100%", maxWidth: 520 }}
            />
            <div className="hint">Chỉ chấp nhận link bắt đầu bằng https://</div>
          </div>
          <button className="btn" type="submit">
            Lưu cấu hình
          </button>
        </form>
      </div>
      <div className="panel">
        <h2>Hình ảnh hệ thống</h2>
        <p>
          Logo và icon tiền tệ dùng trên web — đổi tại đây là toàn hệ thống dùng bản
          mới, không cần sửa code. Chấp nhận PNG/JPG/WebP/GIF (logo tối đa 500KB, icon
          tối đa 300KB). Icon xu và icon kim cương sẽ dùng ở thẻ profile game và các
          bề mặt hiển thị tiền sau này.
        </p>
        <form action="/api/admin/assets" method="post" encType="multipart/form-data">
          <div className="field">
            <label>Logo trang web</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <img src="/api/assets/logo" alt="Logo hiện tại" style={{ width: 54, height: 54, borderRadius: "50%", objectFit: "cover", border: "1px solid #d8e4e1" }} />
              <input type="file" name="logo_file" accept="image/png,image/jpeg,image/webp,image/gif" />
            </div>
            <label className="check" style={{ marginTop: 8 }}>
              <input type="checkbox" name="reset_logo" />
              <span>Đặt lại logo mặc định</span>
            </label>
          </div>
          <div className="field">
            <label>Icon xu (tiền economy)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {coinsSet ? (
                <img src="/api/assets/coins-icon" alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
              ) : (
                <span style={{ width: 44, height: 44, border: "1.5px dashed #b9c8dd", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, color: "#71868e", textAlign: "center" }}>Chưa đặt</span>
              )}
              <input type="file" name="coins_file" accept="image/png,image/jpeg,image/webp,image/gif" />
            </div>
            <label className="check" style={{ marginTop: 8 }}>
              <input type="checkbox" name="reset_coins" />
              <span>Xoá icon xu tuỳ chỉnh</span>
            </label>
          </div>
          <div className="field">
            <label>Icon kim cương (Gems)</label>
            <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
              {gemsSet ? (
                <img src="/api/assets/gems-icon" alt="" style={{ width: 44, height: 44, objectFit: "contain" }} />
              ) : (
                <span style={{ width: 44, height: 44, border: "1.5px dashed #b9c8dd", borderRadius: 10, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 10.5, color: "#71868e", textAlign: "center" }}>Chưa đặt</span>
              )}
              <input type="file" name="gems_file" accept="image/png,image/jpeg,image/webp,image/gif" />
            </div>
            <label className="check" style={{ marginTop: 8 }}>
              <input type="checkbox" name="reset_gems" />
              <span>Xoá icon kim cương tuỳ chỉnh</span>
            </label>
          </div>
          <button className="btn" type="submit">
            Lưu hình ảnh
          </button>
        </form>
      </div>
    </>
  );
}
