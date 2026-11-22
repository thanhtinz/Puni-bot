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
  const aiModel = (await getBotConfig<string>("ai_model").catch(() => null)) ?? "";
  const aiPersonaExtra = (await getBotConfig<string>("ai_persona_extra").catch(() => null)) ?? "";
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
          Riêng khoá API vẫn nằm ở tiến trình bot (biến môi trường AI_API_KEY) vì là
          bí mật; model và chỉ dẫn tính cách thì chỉnh ngay tại trang này.
        </p>
        <form action="/api/admin/ai" method="post">
          <label className="check">
            <input type="checkbox" name="ai_enabled" defaultChecked={enabled} />
            <span>Bật AI trò chuyện trên toàn hệ thống</span>
          </label>
          <div className="field" style={{ marginTop: 16 }}>
            <label htmlFor="ai_model">Model AI</label>
            <input
              id="ai_model"
              name="ai_model"
              type="text"
              defaultValue={aiModel}
              maxLength={80}
              placeholder="Để trống = dùng model mặc định của tiến trình bot"
              style={{ maxWidth: 420 }}
            />
            <div className="hint">Bot đọc model mới ở mỗi câu trả lời, không cần khởi động lại.</div>
          </div>
          <div className="field">
            <label htmlFor="ai_persona_extra">Chỉ dẫn thêm cho tính cách Puni</label>
            <textarea
              id="ai_persona_extra"
              name="ai_persona_extra"
              defaultValue={aiPersonaExtra}
              maxLength={1000}
              rows={4}
              placeholder="Ví dụ: Luôn nhắc mọi người uống nước; đang mùa lễ hội nên nhắc đến sự kiện Giáng sinh…"
              style={{ maxWidth: 640 }}
            />
            <div className="hint">
              Chỉ dẫn này được thêm vào cuối tính cách gốc — quy tắc cứng (trả lời ngắn,
              kết thúc "meo meo ~", an toàn) vẫn đứng trên.
            </div>
          </div>
          <button className="btn" type="submit">
            Lưu cấu hình AI
          </button>
        </form>
      </div>
    </>
  );
}
