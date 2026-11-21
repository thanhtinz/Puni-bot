import { getHeartbeats } from "@/lib/db";

export const dynamic = "force-dynamic";

const STALE_MS = 30_000;

/** Public status: live shard/cluster heartbeats written by the bot
 *  fleet (migration 0005). Before the bot runs, the page says so
 *  plainly instead of faking an "online" state. */
export default async function StatusPage() {
  const rows = await getHeartbeats().catch(() => null);
  const now = Date.now();
  return (
    <>
      <h1>Trạng thái hệ thống</h1>
      {!rows || rows.length === 0 ? (
        <div className="notice">
          Bot chưa chạy (chưa có nhịp tim nào từ các shard). Trang này sẽ hiện trạng thái thật
          ngay khi bot khởi động.
        </div>
      ) : (
        <table className="plain">
          <thead>
            <tr>
              <th>Cluster</th>
              <th>Shard</th>
              <th>Số server</th>
              <th>Ping</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const age = now - new Date(r.updated_at).getTime();
              const alive = age < STALE_MS;
              return (
                <tr key={`${r.cluster_id}-${r.shard_id}`}>
                  <td>{r.cluster_id}</td>
                  <td>{r.shard_id}</td>
                  <td>{r.guild_count}</td>
                  <td>{r.ping_ms} ms</td>
                  <td>{alive ? "Đang hoạt động" : "Mất kết nối"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
