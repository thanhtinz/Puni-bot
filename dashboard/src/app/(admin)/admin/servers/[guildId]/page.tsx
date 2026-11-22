import Link from "next/link";
import { adminGate } from "@/lib/current-session";
import { getGuildRow } from "@/lib/db";
import {
  normalizeAiChatConfig,
  normalizeCommunityConfig,
  normalizeLogConfig,
} from "@/lib/guild-config";
import VerifyForm from "../../verify-form";

export const dynamic = "force-dynamic";

const MODULES: { key: string; label: string }[] = [
  { key: "core", label: "Cơ bản" },
  { key: "moderation", label: "Kiểm duyệt" },
  { key: "manager", label: "Quản lý" },
  { key: "role", label: "Role" },
  { key: "embed", label: "Embed" },
  { key: "reaction", label: "Reaction" },
  { key: "economy", label: "Economy" },
  { key: "games", label: "Minigame" },
  { key: "cozy", label: "Game" },
  { key: "community", label: "Cộng đồng" },
];

export default async function AdminServerDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { guildId } = await params;
  const { saved, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const row = await getGuildRow(guildId).catch(() => null);
  if (!row) {
    return (
      <>
        <h1>Server {guildId}</h1>
        <div className="panel">
          <p>Server này chưa có cấu hình nào trong hệ thống.</p>
          <p>
            <Link href="/admin/servers">← Quay lại danh sách server</Link>
          </p>
        </div>
      </>
    );
  }
  const community = normalizeCommunityConfig(row.community);
  const logging = normalizeLogConfig(row.logging);
  const ai = normalizeAiChatConfig(row.ai_chat);
  const greet = (g: { enabled: boolean; channelId: string | null }) =>
    g.enabled ? `Bật${g.channelId ? ` (kênh ${g.channelId})` : ""}` : "Tắt";

  return (
    <>
      <h1>Server {guildId}</h1>
      {saved ? <div className="notice ok">Đã lưu — bot đọc cấu hình mới trong lần lệnh kế tiếp.</div> : null}
      <div className="panel">
        <h2>Cấu hình hiện tại (chỉ xem)</h2>
        <table className="plain">
          <tbody>
            <tr>
              <th style={{ textAlign: "left", width: 220 }}>Chào mừng (welcome)</th>
              <td>{greet(community.welcome)}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Tạm biệt (goodbye)</th>
              <td>{greet(community.goodbye)}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Cảm ơn boost</th>
              <td>{greet(community.boost)}</td>
            </tr>
            <tr>
              <th style={{ textAlign: "left" }}>Kênh log chung</th>
              <td>{logging.channelId ?? "Chưa đặt"}</td>
            </tr>
          </tbody>
        </table>
        <p className="hint">
          Nội dung chào mừng/log/automod chi tiết do quản trị viên của server tự sửa
          trong Dashboard của họ — ở đây chủ bot chỉ can thiệp prefix, module và AI
          khi cần hỗ trợ hoặc xử lý sự cố.
        </p>
      </div>

      <div className="panel">
        <h2>Can thiệp của chủ bot</h2>
        <form action={`/api/admin/guilds/${guildId}/settings`} method="post">
          <div className="field">
            <label htmlFor="prefix">Prefix lệnh</label>
            <input id="prefix" name="prefix" type="text" defaultValue={row.prefix} maxLength={3} style={{ maxWidth: 120 }} />
            <div className="hint">1–3 ký tự, không chứa khoảng trắng.</div>
          </div>
          <div className="field">
            <label>Module đang bật</label>
            {MODULES.map((m) => (
              <label className="check" key={m.key}>
                <input
                  type="checkbox"
                  name={`mod_${m.key}`}
                  defaultChecked={row.modules?.[m.key] !== false}
                />
                <span>{m.label}</span>
              </label>
            ))}
          </div>
          <div className="field">
            <label>AI trò chuyện ở server này</label>
            <label className="check">
              <input type="checkbox" name="ai_enabled" defaultChecked={ai.enabled} />
              <span>Cho phép Puni trả lời @mention trong server này</span>
            </label>
          </div>
          <button className="btn" type="submit">
            Lưu can thiệp
          </button>
        </form>
        <p style={{ marginTop: 14 }}>
          <Link href="/admin/servers">← Quay lại danh sách server</Link>
        </p>
      </div>
    </>
  );
}
