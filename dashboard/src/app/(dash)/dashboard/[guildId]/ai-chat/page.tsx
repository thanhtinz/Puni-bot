import { getGuildRow } from "@/lib/db";
import { normalizeAiChatConfig } from "@/lib/guild-config";
import PawPrint from "@/components/paw";

export const dynamic = "force-dynamic";

export default async function AiChatPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { guildId } = await params;
  const { saved } = await searchParams;
  const row = await getGuildRow(guildId).catch(() => null);
  const cfg = normalizeAiChatConfig(row?.ai_chat);
  return (
    <>
      {saved && <div className="saved">Đã lưu cấu hình AI trò chuyện.</div>}
      <div className="panel">
        <h2 style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span style={{ color: "var(--accent)", display: "inline-flex" }}>
            <PawPrint size={24} />
          </span>
          AI trò chuyện
        </h2>
        <p>
          Khi thành viên <strong>@tag Puni</strong> kèm câu hỏi, Puni sẽ trả lời bằng AI theo
          phong cách mèo cute — mỗi câu đều kết thúc bằng <strong>“meo meo ~”</strong>. Tin nhắn
          bắt đầu bằng prefix lệnh vẫn chạy lệnh như bình thường, không qua AI.
        </p>
        <p>
          Mỗi thành viên có thời gian chờ 8 giây giữa hai câu hỏi để tránh spam. Nếu chỉ tag mà
          không hỏi gì, Puni đáp lại bằng câu chào sẵn, không tốn lượt AI.
        </p>
        <form action={`/api/guilds/${guildId}/settings`} method="post">
          <input type="hidden" name="section" value="aichat" />
          <div className="check">
            <input id="ai-enabled" name="enabled" type="checkbox" defaultChecked={cfg.enabled} />
            <label htmlFor="ai-enabled">Cho phép Puni trả lời khi được @tag trong server này</label>
          </div>
          <div className="hint">
            Tính năng cần chủ bot đã cấu hình khoá AI cho hệ thống; tắt ở đây thì server này
            không dùng AI kể cả khi hệ thống có bật.
          </div>
          <button className="btn" type="submit">
            Lưu cấu hình
          </button>
        </form>
      </div>
    </>
  );
}
