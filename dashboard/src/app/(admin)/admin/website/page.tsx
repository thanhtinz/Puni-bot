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
    </>
  );
}
