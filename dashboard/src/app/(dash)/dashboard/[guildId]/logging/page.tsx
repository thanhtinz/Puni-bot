import { getGuildRow } from "@/lib/db";
import { LOG_GROUPS, LOG_GROUP_LABELS, normalizeLogConfig } from "@/lib/guild-config";

export const dynamic = "force-dynamic";

export default async function LoggingPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { guildId } = await params;
  const { saved } = await searchParams;
  const row = await getGuildRow(guildId).catch(() => null);
  const cfg = normalizeLogConfig(row?.logging);
  return (
    <>
      {saved && <div className="saved">Đã lưu cấu hình log.</div>}
      <div className="panel">
        <h2>Log sự kiện</h2>
        <p>Bot ghi các sự kiện vào một kênh log riêng. Bật/tắt được từng nhóm sự kiện.</p>
        <form action={`/api/guilds/${guildId}/settings`} method="post">
          <input type="hidden" name="section" value="logging" />
          <div className="check">
            <input id="log-enabled" name="enabled" type="checkbox" defaultChecked={cfg.enabled} />
            <label htmlFor="log-enabled">Bật hệ log</label>
          </div>
          <div className="field">
            <label htmlFor="log-channel">Kênh log (ID kênh)</label>
            <input id="log-channel" name="channel" type="text" defaultValue={cfg.channelId ?? ""} placeholder="VD: 123456789012345678" />
          </div>
          <div className="field">
            <label>Nhóm sự kiện</label>
            {LOG_GROUPS.map((g) => (
              <div className="check" key={g}>
                <input id={`g-${g}`} name={`group_${g}`} type="checkbox" defaultChecked={cfg.groups[g]} />
                <label htmlFor={`g-${g}`}>{LOG_GROUP_LABELS[g]}</label>
              </div>
            ))}
          </div>
          <button className="btn" type="submit">
            Lưu cấu hình
          </button>
        </form>
      </div>
    </>
  );
}
