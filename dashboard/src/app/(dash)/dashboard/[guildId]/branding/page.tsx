import { getGuildRow } from "@/lib/db";
import { normalizeBranding } from "@/lib/guild-config";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  missing: "Chưa chọn file ảnh.",
  type: "Chỉ nhận ảnh PNG, JPG, WebP hoặc GIF.",
  size: "Ảnh tối đa 200KB.",
};

/**
 * White label page (spec 6.25): per-guild branding the bot wears
 * inside this server — its nickname and guild-member avatar.
 * Leaving both empty restores the default Puni identity.
 */
export default async function BrandingPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string; err?: string }>;
}) {
  const { guildId } = await params;
  const { saved, err } = await searchParams;
  const row = await getGuildRow(guildId).catch(() => null);
  const cfg = normalizeBranding(row?.branding);
  return (
    <>
      {saved && <div className="saved">Đã lưu thương hiệu. Bot áp dụng trong ít phút (hoặc ngay khi vào lại server).</div>}
      {err && <div className="saved" style={{ background: "#fdecec", color: "#8c2f2f" }}>{ERRORS[err] ?? "Không lưu được."}</div>}
      <div className="panel">
        <h2>Thương hiệu trong server (White label)</h2>
        <p>
          Đặt biệt danh và ảnh đại diện riêng cho Puni <strong>chỉ trong server này</strong> —
          qua server khác Puni vẫn giữ tên và ảnh mặc định. Để trống cả hai là quay về mặc định.
        </p>
        <form action={`/api/guilds/${guildId}/settings`} method="post">
          <input type="hidden" name="section" value="branding" />
          <div className="field">
            <label htmlFor="nickname">Biệt danh của bot trong server</label>
            <input id="nickname" name="nickname" type="text" defaultValue={cfg.nickname} maxLength={32} placeholder="Ví dụ: Puni — Trợ lý BNT" />
            <div className="hint">Tối đa 32 ký tự. Để trống = dùng tên mặc định của bot.</div>
          </div>
          <div className="check">
            <input id="remove-avatar" name="remove_avatar" type="checkbox" />
            <label htmlFor="remove-avatar">Xoá ảnh đại diện riêng, dùng ảnh mặc định</label>
          </div>
          <button className="btn" type="submit">Lưu thương hiệu</button>
        </form>
      </div>
      <div className="panel">
        <h2>Ảnh đại diện riêng</h2>
        {cfg.avatarDataUri ? (
          <p style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img src={cfg.avatarDataUri} alt="Ảnh đại diện riêng của bot trong server này" style={{ width: 72, height: 72, borderRadius: "50%", objectFit: "cover" }} />
            <span>Đang dùng ảnh riêng này trong server.</span>
          </p>
        ) : (
          <p>Chưa đặt ảnh riêng — bot dùng ảnh Puni mặc định.</p>
        )}
        <form action={`/api/guilds/${guildId}/branding-avatar`} method="post" encType="multipart/form-data">
          <div className="field">
            <label htmlFor="avatar">Tải ảnh mới (PNG/JPG/WebP/GIF, tối đa 200KB)</label>
            <input id="avatar" name="avatar" type="file" accept="image/png,image/jpeg,image/webp,image/gif" required />
          </div>
          <button className="btn" type="submit">Tải ảnh lên</button>
        </form>
      </div>
    </>
  );
}
