import { adminGate } from "@/lib/current-session";
import { getHeartbeats } from "@/lib/db";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

export default async function AdminClustersPage() {
  const gate = await adminGate();
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm />;
    return null;
  }
  const rows = await getHeartbeats().catch(() => null);
  const now = Date.now();
  return (
    <>
      <h1>Cluster &amp; Shard</h1>
      <p>Nhịp tim do từng shard tự ghi (bảng shard_heartbeats). Quá 30 giây không cập nhật = coi như shard đã chết.</p>
      {!rows || rows.length === 0 ? (
        <div className="notice">Chưa có shard nào chạy.</div>
      ) : (
        <table className="plain">
          <thead>
            <tr>
              <th>Cluster</th>
              <th>Shard</th>
              <th>Server</th>
              <th>Ping</th>
              <th>Cập nhật</th>
              <th>Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => {
              const age = now - new Date(r.updated_at).getTime();
              return (
                <tr key={`${r.cluster_id}-${r.shard_id}`}>
                  <td>{r.cluster_id}</td>
                  <td>{r.shard_id}</td>
                  <td>{r.guild_count}</td>
                  <td>{r.ping_ms} ms</td>
                  <td>{Math.round(age / 1000)}s trước</td>
                  <td>{age < 30_000 ? "Đang sống" : "Đã chết"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}
