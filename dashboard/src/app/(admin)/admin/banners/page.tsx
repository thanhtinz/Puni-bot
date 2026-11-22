import Link from "next/link";
import { adminGate } from "@/lib/current-session";
import { BANNER_KINDS, listBannersAdmin } from "@/lib/banners-admin";
import { SHOP_GAMES } from "@/lib/shop";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

const KIND_LABEL: Record<string, string> = {
  standard: "Thường",
  limited: "Giới hạn theo họ",
  event: "Sự kiện",
  beginner: "Tân thủ",
};

const dtLocal = (d: Date | null) => (d ? d.toISOString().slice(0, 16) : "");
const dtShow = (d: Date | null) => (d ? d.toISOString().slice(0, 16).replace("T", " ") : "—");

export default async function AdminBannersPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; err?: string; edit?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { saved, err, edit, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const rows = await listBannersAdmin().catch(() => []);
  const editing = edit ? rows.find((r) => r.id === edit) : undefined;
  const e = editing;

  return (
    <>
      <h1>Banner gacha</h1>
      {saved ? <div className="notice ok">Đã lưu banner.</div> : null}
      {err ? <div className="notice">Không thực hiện được: {err}</div> : null}
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Banner hiện ở trang Mở Thẻ của người chơi và trong lệnh gacha của bot.
        Pool theo họ lấy mọi lá của họ đó; pool theo danh sách chỉ lấy đúng các
        loài liệt kê (để trống = toàn bộ catalog). Mã banner không sửa được sau
        khi tạo vì dữ liệu bảo hiểm (pity) của người chơi gắn theo mã.
      </p>

      <div className="panel">
        <h2>{e ? `Sửa banner ${e.id}` : "Thêm banner"}</h2>
        <form action="/api/admin/banners" method="post">
          <input type="hidden" name="action" value="save" />
          {e ? <input type="hidden" name="original_id" value={e.id} /> : null}
          <div className="field">
            <label htmlFor="f-id">Mã banner</label>
            <input id="f-id" name="id" defaultValue={e?.id ?? ""} readOnly={!!e}
              placeholder="vd: op-2026-tet" />
          </div>
          <div className="field">
            <label htmlFor="f-name">Tên banner</label>
            <input id="f-name" name="name" defaultValue={e?.name ?? ""} placeholder="vd: One Piece — Romance Dawn" />
          </div>
          <div className="field">
            <label htmlFor="f-kind">Loại</label>
            <select id="f-kind" name="kind" defaultValue={e?.kind ?? "standard"}>
              {BANNER_KINDS.map((k) => (
                <option key={k} value={k}>{KIND_LABEL[k]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-cost">Giá một lượt mở (Coins)</label>
            <input id="f-cost" name="cost_coins" type="number" min={0} step={1}
              defaultValue={e?.costCoins ?? 500} />
          </div>
          <div className="field">
            <label htmlFor="f-prefix">Pool theo họ thẻ</label>
            <select id="f-prefix" name="pool_prefix" defaultValue={e?.poolPrefix ?? ""}>
              <option value="">— Không theo họ —</option>
              {SHOP_GAMES.map((g) => (
                <option key={g.prefix} value={g.prefix}>{g.name} ({g.prefix})</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-pool">Pool theo danh sách loài (mỗi mã một dòng hoặc cách nhau dấu phẩy)</label>
            <textarea id="f-pool" name="pool_species" rows={4}
              defaultValue={(e?.poolSpecies ?? []).join("\n")} placeholder={"op01-001\nop01-002"} />
          </div>
          <div className="field">
            <label htmlFor="f-featured">Loài nổi bật (featured)</label>
            <textarea id="f-featured" name="featured_species" rows={2}
              defaultValue={(e?.featuredSpecies ?? []).join("\n")} placeholder="op01-016" />
          </div>
          <div className="field">
            <label htmlFor="f-image">Ảnh banner (đường dẫn hoặc URL)</label>
            <input id="f-image" name="image_url" defaultValue={e?.imageUrl ?? ""}
              placeholder="/packs/pokemon-pack.jpg" />
          </div>
          <div className="field">
            <label htmlFor="f-start">Bắt đầu (UTC, để trống = ngay)</label>
            <input id="f-start" name="starts_at" type="datetime-local" defaultValue={dtLocal(e?.startsAt ?? null)} />
          </div>
          <div className="field">
            <label htmlFor="f-end">Kết thúc (UTC, để trống = không hạn)</label>
            <input id="f-end" name="ends_at" type="datetime-local" defaultValue={dtLocal(e?.endsAt ?? null)} />
          </div>
          <button type="submit" className="btn">{e ? "Lưu banner" : "Tạo banner"}</button>
          {e ? <Link className="btn secondary" href="/admin/banners" style={{ marginLeft: 8 }}>Huỷ sửa</Link> : null}
        </form>
      </div>

      <div className="panel">
        <h2>Tất cả banner ({rows.length})</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Mã</th><th>Tên</th><th>Loại</th><th>Giá</th><th>Pool</th>
              <th>Hiệu lực (UTC)</th><th>Lượt mở</th><th>Trạng thái</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td><code>{r.id}</code></td>
                <td>{r.name}</td>
                <td>{KIND_LABEL[r.kind] ?? r.kind}</td>
                <td>{r.costCoins.toLocaleString("en-US")}</td>
                <td>{r.poolPrefix ? `họ ${r.poolPrefix}` : r.poolSpecies.length ? `${r.poolSpecies.length} loài` : "toàn bộ"}</td>
                <td>{dtShow(r.startsAt)} → {dtShow(r.endsAt)}</td>
                <td>{r.pulls.toLocaleString("en-US")}</td>
                <td>{r.enabled ? "Đang bật" : "Đã tắt"}</td>
                <td style={{ whiteSpace: "nowrap" }}>
                  <Link className="btn secondary" href={`/admin/banners?edit=${encodeURIComponent(r.id)}`}>Sửa</Link>{" "}
                  <form action="/api/admin/banners" method="post" style={{ display: "inline" }}>
                    <input type="hidden" name="action" value="toggle" />
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="btn secondary">{r.enabled ? "Tắt" : "Bật"}</button>
                  </form>{" "}
                  <form action="/api/admin/banners" method="post" style={{ display: "inline" }}>
                    <input type="hidden" name="action" value="delete" />
                    <input type="hidden" name="id" value={r.id} />
                    <button type="submit" className="btn secondary">Xoá</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
