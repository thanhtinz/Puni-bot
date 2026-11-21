import { getGuildRow } from "@/lib/db";
import { normalizeCommunityConfig, type GreetingConfig } from "@/lib/guild-config";

export const dynamic = "force-dynamic";

function GreetingFields({ name, label, cfg }: { name: string; label: string; cfg: GreetingConfig }) {
  return (
    <fieldset style={{ border: "1px solid var(--border)", borderRadius: 10, marginBottom: 18, padding: 16 }}>
      <legend style={{ fontWeight: 800, padding: "0 6px" }}>{label}</legend>
      <div className="check">
        <input id={`${name}-enabled`} name={`${name}_enabled`} type="checkbox" defaultChecked={cfg.enabled} />
        <label htmlFor={`${name}-enabled`}>Bật</label>
      </div>
      <div className="field">
        <label htmlFor={`${name}-channel`}>Kênh gửi (ID kênh)</label>
        <input
          id={`${name}-channel`}
          name={`${name}_channel`}
          type="text"
          defaultValue={cfg.channelId ?? ""}
          placeholder="VD: 123456789012345678"
        />
      </div>
      <div className="field">
        <label htmlFor={`${name}-message`}>Nội dung tin nhắn</label>
        <textarea id={`${name}-message`} name={`${name}_message`} defaultValue={cfg.message} />
        <div className="hint">
          Biến dùng được: {"{user}"} (tag người dùng), {"{username}"}, {"{server}"}, {"{count}"} (số thành viên).
        </div>
      </div>
    </fieldset>
  );
}

export default async function CommunityPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { guildId } = await params;
  const { saved } = await searchParams;
  const row = await getGuildRow(guildId).catch(() => null);
  const cfg = normalizeCommunityConfig(row?.community);
  return (
    <>
      {saved && <div className="saved">Đã lưu cấu hình chào mừng.</div>}
      <div className="panel">
        <h2>Chào mừng / Tạm biệt / Boost</h2>
        <form action={`/api/guilds/${guildId}/settings`} method="post">
          <input type="hidden" name="section" value="community" />
          <GreetingFields name="welcome" label="Tin chào mừng (thành viên mới)" cfg={cfg.welcome} />
          <GreetingFields name="goodbye" label="Tin tạm biệt (thành viên rời)" cfg={cfg.goodbye} />
          <GreetingFields name="boost" label="Tin cảm ơn boost" cfg={cfg.boost} />
          <button className="btn" type="submit">
            Lưu cấu hình
          </button>
        </form>
      </div>
    </>
  );
}
