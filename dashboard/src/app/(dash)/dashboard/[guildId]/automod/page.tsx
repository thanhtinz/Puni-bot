import { getGuildRow } from "@/lib/db";
import { normalizeAutomodConfig } from "@/lib/guild-config";

export const dynamic = "force-dynamic";

export default async function AutomodPage({
  params,
  searchParams,
}: {
  params: Promise<{ guildId: string }>;
  searchParams: Promise<{ saved?: string }>;
}) {
  const { guildId } = await params;
  const { saved } = await searchParams;
  const row = await getGuildRow(guildId).catch(() => null);
  const cfg = normalizeAutomodConfig(row?.automod);
  return (
    <>
      {saved && <div className="saved">Đã lưu cấu hình automod.</div>}
      <div className="panel">
        <h2>Kiểm duyệt tự động (automod)</h2>
        <p>
          Tin nhắn vi phạm sẽ bị xoá ngay. Thành viên có quyền kiểm duyệt được miễn trừ. Mọi
          lần automod ra tay đều được ghi vào log kiểm duyệt.
        </p>
        <form action={`/api/guilds/${guildId}/settings`} method="post">
          <input type="hidden" name="section" value="automod" />
          <div className="check">
            <input id="am-enabled" name="enabled" type="checkbox" defaultChecked={cfg.enabled} />
            <label htmlFor="am-enabled">Bật automod</label>
          </div>
          <div className="field">
            <label htmlFor="am-words">Từ cấm (mỗi từ một dòng)</label>
            <textarea id="am-words" name="blocked_words" defaultValue={cfg.blockedWords.join("\n")} />
            <div className="hint">Không phân biệt hoa thường; tin chứa từ này sẽ bị xoá.</div>
          </div>
          <div className="check">
            <input id="am-links" name="block_links" type="checkbox" defaultChecked={cfg.blockLinks} />
            <label htmlFor="am-links">Chặn mọi link http/https</label>
          </div>
          <div className="field">
            <label htmlFor="am-caps">Tỉ lệ chữ hoa tối đa (0 = tắt luật này, 0.8 = 80%)</label>
            <input id="am-caps" name="caps_ratio" type="text" defaultValue={String(cfg.capsRatio)} />
          </div>
          <div className="field">
            <label htmlFor="am-capsmin">Chỉ xét tin dài từ (ký tự)</label>
            <input id="am-capsmin" name="caps_min" type="text" defaultValue={String(cfg.capsMinLength)} />
          </div>
          <div className="check">
            <input id="am-warn" name="warn_on_delete" type="checkbox" defaultChecked={cfg.warnOnDelete} />
            <label htmlFor="am-warn">Tạo case cảnh cáo khi automod xoá tin</label>
          </div>
          <button className="btn" type="submit">
            Lưu cấu hình
          </button>
        </form>
      </div>
    </>
  );
}
