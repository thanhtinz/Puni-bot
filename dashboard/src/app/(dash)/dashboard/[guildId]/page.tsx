import { getGuildRow } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GuildOverviewPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { guildId } = await params;
  const { saved } = await searchParams;
  const row = await getGuildRow(guildId).catch(() => null);
  const prefix = row?.prefix ?? "!";
  return (
    <>
      {saved && <div className="saved">Đã lưu. Cấu hình áp dụng ngay cho bot.</div>}
      <div className="panel">
        <h2>Tiền tố lệnh (prefix)</h2>
        <p>
          Lệnh tiền tố dùng ký tự này ở đầu, ví dụ <code>{prefix}ping</code>. Lệnh slash không
          bị ảnh hưởng.
        </p>
        <form action={`/api/guilds/${guildId}/settings`} method="post">
          <input type="hidden" name="section" value="prefix" />
          <div className="field">
            <label htmlFor="prefix">Prefix</label>
            <input id="prefix" name="prefix" type="text" defaultValue={prefix} maxLength={3} required />
            <div className="hint">1–3 ký tự, không chứa khoảng trắng.</div>
          </div>
          <button className="btn" type="submit">
            Lưu prefix
          </button>
        </form>
      </div>
      <div className="panel">
        <h2>Khu Shop trong server</h2>
        <p>
          Trạng thái hiện tại:{" "}
          <strong>{row?.shop_enabled ? "ĐÃ BẬT Shop" : "Chưa bật Shop"}</strong>
        </p>
        <p>
          Khi Shop chưa bật, server này không có bất kỳ menu hay lệnh Shop nào — đúng luật ẩn
          Shop. Việc bật Shop cho một server do chủ bot thực hiện ở Admin panel.
        </p>
      </div>
    </>
  );
}
