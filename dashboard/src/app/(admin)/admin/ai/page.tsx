import { adminGate } from "@/lib/current-session";
import { getBotConfig, listGuildAdminRows } from "@/lib/db";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

export default async function AdminAiPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { saved, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const enabledRaw = await getBotConfig<boolean>("ai_enabled").catch(() => null);
  const enabled = enabledRaw !== false;
  const rows = await listGuildAdminRows().catch(() => []);
  const guildOn = rows.filter((r) => r.ai_chat?.enabled !== false).length;
  return (
    <>
      <h1>AI trò chuyện</h1>
      {saved ? <div className="notice ok">Đã lưu — bot áp dụng công tắc trong tối đa 30 giây.</div> : null}
      <div className="cards" style={{ marginBottom: 20 }}>
        <div className="card">
          <h3>{enabled ? "Đang bật" : "Đang tắt"}</h3>
          <p>Công tắc tổng của chủ bot (áp cho mọi server)</p>
        </div>
        <div className="card">
          <h3>
            {guildOn}/{rows.length}
          </h3>
          <p>Server đang bật AI trong cấu hình riêng của họ</p>
        </div>
      </div>
      <div className="panel">
        <h2>Công tắc tổng</h2>
        <p>
          Khi tắt, Puni ngừng trả lời @mention ở MỌI server ngay cả khi server đó đang
          bật AI — dùng khi cần ngắt khẩn cấp (provider lỗi, chi phí tăng bất thường).
          Khoá API và model được cấu hình ở tiến trình bot (biến môi trường
          AI_API_KEY / AI_MODEL), không đặt trên web.
        </p>
        <form action="/api/admin/ai" method="post">
          <label className="check">
            <input type="checkbox" name="ai_enabled" defaultChecked={enabled} />
            <span>Bật AI trò chuyện trên toàn hệ thống</span>
          </label>
          <button className="btn" type="submit">
            Lưu công tắc
          </button>
        </form>
      </div>
    </>
  );
}
