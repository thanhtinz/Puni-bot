import Link from "next/link";
import { adminGate } from "@/lib/current-session";
import { listGuildAdminRows } from "@/lib/db";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

const MODULE_LABELS: Record<string, string> = {
  core: "Cơ bản",
  moderation: "Kiểm duyệt",
  manager: "Quản lý",
  role: "Role",
  embed: "Embed",
  reaction: "Reaction",
  economy: "Economy",
  games: "Minigame",
  cozy: "Game",
  community: "Cộng đồng",
};

export default async function AdminServersPage({
  searchParams,
}: {
  searchParams: Promise<{ verify?: string; q?: string }>;
}) {
  const gate = await adminGate();
  const { verify, q } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const rows = await listGuildAdminRows().catch(() => []);
  const query = (q ?? "").trim();
  const shown = query ? rows.filter((r) => r.guild_id.includes(query)) : rows;
  return (
    <>
      <h1>Server đã cấu hình</h1>
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Mọi server đã từng lưu cấu hình vào dashboard hoặc bằng lệnh. Trang này chỉ để
        chủ bot xem tổng quan — việc chỉnh cấu hình từng server do quản trị viên của
        server đó làm trong dashboard của họ.
      </p>
      <form action="/admin/servers" method="get" style={{ display: "flex", gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        <input name="q" type="text" placeholder="Lọc theo Guild ID…" defaultValue={query} style={{ minWidth: 280 }} />
        <button className="btn" type="submit">Lọc</button>
        {query ? <span style={{ alignSelf: "center" }}>{shown.length}/{rows.length} server khớp</span> : null}
      </form>
      <div className="panel" style={{ maxWidth: 980 }}>
        {shown.length === 0 ? (
          <p>Chưa có server nào lưu cấu hình.</p>
        ) : (
          <table className="plain">
            <thead>
              <tr>
                <th>Guild ID</th>
                <th>Prefix</th>
                <th>Module đang tắt</th>
                <th>AI trò chuyện</th>
                <th>Cập nhật gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const off = Object.entries(r.modules ?? {})
                  .filter(([, v]) => v === false)
                  .map(([k]) => MODULE_LABELS[k] ?? k);
                return (
                  <tr key={r.guild_id}>
                    <td>
                      <Link href={`/admin/servers/${r.guild_id}`}>{r.guild_id}</Link>
                    </td>
                    <td>
                      <code>{r.prefix}</code>
                    </td>
                    <td>{off.length ? off.join(", ") : "—"}</td>
                    <td>{r.ai_chat?.enabled === false ? "Tắt" : "Bật"}</td>
                    <td>{new Date(r.updated_at).toLocaleString("vi-VN")}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
