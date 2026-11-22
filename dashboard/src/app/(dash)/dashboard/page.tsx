import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/current-session";
import { manageableGuilds } from "@/lib/session";
import { listConfiguredGuildIds } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GuildPickerPage() {
  const session = await currentSession();
  if (!session) return null;
  const guilds = manageableGuilds(session);
  // Player routing (spec 6.24): no manageable servers at all -> the
  // player area is the right home, not an empty picker.
  if (guilds.length === 0) redirect("/me");
  const configured = new Set(await listConfiguredGuildIds().catch(() => [] as string[]));
  return (
    <>
      <h1>Server của tôi</h1>
      <p>Chọn một server để cấu hình Puni. Chỉ hiện các server bạn có quyền Quản lý server hoặc Quản trị viên.</p>
      {guilds.length === 0 ? (
        <div className="notice">Bạn chưa quản lý server nào (hoặc Discord chưa trả danh sách server).</div>
      ) : (
        <div className="guild-grid">
          {guilds.map((g) => (
            <div className="guild-card" key={g.id}>
              <div className="gname">{g.name || "(không tên)"}</div>
              <div className="gid">ID: {g.id}</div>
              <div style={{ marginBottom: 10 }}>
                {configured.has(g.id) ? (
                  <span className="tag">Puni đã có mặt</span>
                ) : (
                  <span className="tag">Chưa có dữ liệu cấu hình</span>
                )}
              </div>
              <Link href={`/dashboard/${g.id}`} className="btn secondary">
                Mở cấu hình
              </Link>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
