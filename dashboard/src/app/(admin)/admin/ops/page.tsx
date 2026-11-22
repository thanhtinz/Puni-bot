import { adminGate } from "@/lib/current-session";
import { getBotConfig, getHeartbeats, listBotConfigMeta } from "@/lib/db";
import VerifyForm from "../verify-form";
import { IconActivity } from "@/components/icons";

export const dynamic = "force-dynamic";

interface RuntimeStatus {
  startedAt?: string;
  aiConfigured?: boolean;
  aiEnvModel?: string;
}

const CONFIG_LABELS: Record<string, string> = {
  economy: "Thông số economy (tên tiền, daily, streak)",
  ai_enabled: "Công tắc tổng AI trò chuyện",
  ai_model: "Model AI",
  ai_persona_extra: "Chỉ dẫn tính cách AI",
  bot_enabled: "Công tắc tổng của bot",
  maintenance_message: "Câu trả lời khi bảo trì",
  membership_tiers: "Các gói Membership",
  runtime_status: "Trạng thái bot tự báo (ghi bởi tiến trình bot)",
};

const DEFAULT_MAINTENANCE = "Puni đang bảo trì một chút, bạn quay lại sau nhé!";

function EnvRow({ label, ok, hint }: { label: string; ok: boolean; hint: string }) {
  return (
    <div className="src-row" style={{ gridTemplateColumns: "240px 110px 1fr" }}>
      <span className="sn">{label}</span>
      <span className="sv" style={{ textAlign: "left", color: ok ? "#1d9e75" : "#c2452d" }}>
        {ok ? "Đã đặt" : "Chưa đặt"}
      </span>
      <span style={{ color: "#71868e", fontSize: 13.5 }}>{hint}</span>
    </div>
  );
}

export default async function AdminOpsPage({
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
  const enabledRaw = await getBotConfig<boolean>("bot_enabled").catch(() => null);
  const botEnabled = enabledRaw !== false;
  const maintenance =
    (await getBotConfig<string>("maintenance_message").catch(() => null)) || DEFAULT_MAINTENANCE;
  const runtime = await getBotConfig<RuntimeStatus>("runtime_status").catch(() => null);
  const heartbeats = await getHeartbeats().catch(() => null);
  const configMeta = await listBotConfigMeta().catch(() => null);
  const alive = (heartbeats ?? []).filter(
    (h) => Date.now() - new Date(h.updated_at).getTime() < 30_000,
  ).length;

  return (
    <>
      <h1>Vận hành bot</h1>
      {saved ? (
        <div className="notice ok">Đã lưu — bot áp dụng trong tối đa 30 giây.</div>
      ) : null}
      <div className="cards" style={{ marginBottom: 20 }}>
        <div className="card">
          <span className="stat-ico">
            <IconActivity />
          </span>
          <h3>{botEnabled ? "Đang bật" : "Đang tắt (bảo trì)"}</h3>
          <p>Công tắc tổng của bot trên mọi server</p>
        </div>
        <div className="card">
          <h3>
            {alive}/{(heartbeats ?? []).length}
          </h3>
          <p>Shard đang sống / tổng shard có nhịp tim</p>
        </div>
        <div className="card">
          <h3>
            {runtime?.startedAt
              ? new Date(runtime.startedAt).toLocaleString("vi-VN")
              : "Chưa rõ"}
          </h3>
          <p>Lần khởi động gần nhất bot tự báo về</p>
        </div>
        <div className="card">
          <h3>{runtime ? (runtime.aiConfigured ? "Đã cấu hình" : "Chưa có khoá") : "Chưa rõ"}</h3>
          <p>Khoá API của AI trò chuyện ở tiến trình bot{runtime?.aiEnvModel ? ` (model env: ${runtime.aiEnvModel})` : ""}</p>
        </div>
      </div>

      <div className="panel">
        <h2>Công tắc tổng</h2>
        <p>
          Tắt bot khi cần bảo trì hoặc xử lý sự cố: mọi lệnh (slash + prefix) của
          người dùng thường sẽ nhận câu trả lời bảo trì dưới đây, AI trò chuyện
          cũng im lặng. Riêng tài khoản chủ bot vẫn dùng lệnh bình thường. Bật
          lại là bot chạy tiếp, không mất dữ liệu.
        </p>
        <form action="/api/admin/ops" method="post">
          <label className="check">
            <input type="checkbox" name="bot_enabled" defaultChecked={botEnabled} />
            <span>Bật bot (bỏ tick = chế độ bảo trì)</span>
          </label>
          <div className="field" style={{ marginTop: 14 }}>
            <label htmlFor="maintenance_message">Câu trả lời khi đang bảo trì</label>
            <input
              id="maintenance_message"
              name="maintenance_message"
              type="text"
              defaultValue={maintenance}
              maxLength={200}
              style={{ maxWidth: 560 }}
            />
          </div>
          <button className="btn" type="submit">
            Lưu vận hành
          </button>
        </form>
      </div>

      <div className="panel">
        <h2>Trạng thái cấu hình phía web</h2>
        <p>
          Chỉ kiểm tra biến môi trường của tiến trình web này (đã đặt hay chưa,
          không hiện giá trị). Token bot và khoá AI nằm ở tiến trình bot, không
          đi qua web.
        </p>
        <EnvRow label="DATABASE_URL" ok={Boolean(process.env.DATABASE_URL)} hint="Cơ sở dữ liệu dùng chung bot + web" />
        <EnvRow label="DISCORD_CLIENT_ID" ok={Boolean(process.env.DISCORD_CLIENT_ID)} hint="OAuth đăng nhập Discord" />
        <EnvRow label="DISCORD_CLIENT_SECRET" ok={Boolean(process.env.DISCORD_CLIENT_SECRET)} hint="OAuth đăng nhập Discord" />
        <EnvRow label="SESSION_SECRET" ok={Boolean(process.env.SESSION_SECRET)} hint="Khoá ký cookie phiên đăng nhập" />
        <EnvRow
          label="Lớp bảo vệ 2 của Admin"
          ok={Boolean(process.env.ADMIN_PANEL_PASSWORD_SHA256 || process.env.OWNER_TOTP_SECRET)}
          hint="Mật khẩu / TOTP riêng của chủ bot"
        />
      </div>

      <div className="panel">
        <h2>Cấu hình toàn cục hiện tại</h2>
        <p>
          Mọi cấu hình cấp hệ thống mà chủ bot đã lưu (chỉ hiện tên mục và lần sửa
          gần nhất — giá trị nằm ở từng trang chuyên trách).
        </p>
        {configMeta && configMeta.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Mục cấu hình</th>
                <th>Sửa gần nhất</th>
              </tr>
            </thead>
            <tbody>
              {configMeta.map((c) => (
                <tr key={c.key}>
                  <td>{CONFIG_LABELS[c.key] ?? c.key}</td>
                  <td>{new Date(c.updated_at).toLocaleString("vi-VN")}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Chưa có cấu hình toàn cục nào được lưu.</p>
        )}
      </div>
    </>
  );
}
