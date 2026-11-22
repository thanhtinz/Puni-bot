import Link from "next/link";
import { adminGate } from "@/lib/current-session";
import { ITEM_CATEGORIES, listItems, type ItemRow } from "@/lib/db";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

const fmt = (n: string) => Number.parseInt(n, 10).toLocaleString("vi-VN");
const catLabel = (id: string) => ITEM_CATEGORIES.find((c) => c.id === id)?.label ?? id;

export default async function AdminItemsPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; err?: string; edit?: string; cat?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { saved, err, edit, cat, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const all = await listItems().catch(() => null);
  const rows = cat ? (all ?? []).filter((r) => r.category === cat) : all;
  const editing: ItemRow | undefined = edit ? all?.find((r) => r.id === edit) : undefined;
  const e = editing;

  return (
    <>
      <h1>Quản lý Item — gồm nông trại & cá</h1>
      {saved ? <div className="notice ok">Đã lưu thay đổi item.</div> : null}
      {err ? <div className="notice">Không thực hiện được: {err}</div> : null}
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Mọi vật phẩm của Cozy World ở một chỗ: hạt giống, nông sản, dụng cụ nông
        trại, cá câu được, vật phẩm tiêu hao… Lọc theo nhóm ở dưới. Cá câu được
        quản lý tại đây (nhóm Cá) — hệ thống câu cá lấy tên cá từ nhóm này.
      </p>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
        <Link className="btn secondary sm" href="/admin/items">
          Tất cả ({all?.length ?? 0})
        </Link>
        {ITEM_CATEGORIES.map((c) => (
          <Link key={c.id} className="btn secondary sm" href={`/admin/items?cat=${c.id}`}>
            {c.label} ({(all ?? []).filter((r) => r.category === c.id).length})
          </Link>
        ))}
      </div>

      <div className="panel">
        <h2>{e ? `Sửa item: ${e.name}` : "Thêm item mới"}</h2>
        <form action="/api/admin/game/items" method="post">
          <input type="hidden" name="action" value="save" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="id">Mã item (slug)</label>
              <input id="id" name="id" type="text" required defaultValue={e?.id ?? ""} placeholder="hat-giong-ca-chua" style={{ width: 220 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="name">Tên item</label>
              <input id="name" name="name" type="text" required defaultValue={e?.name ?? ""} style={{ width: 240 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="category">Nhóm</label>
              <select id="category" name="category" defaultValue={e?.category ?? cat ?? "other"}>
                {ITEM_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="price_coins">Giá mua (Coins)</label>
              <input id="price_coins" name="price_coins" type="number" min={0} defaultValue={e ? Number.parseInt(e.price_coins, 10) : 0} style={{ width: 140 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="price_gems">Giá mua (Gems)</label>
              <input id="price_gems" name="price_gems" type="number" min={0} defaultValue={e ? Number.parseInt(e.price_gems, 10) : 0} style={{ width: 140 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="sell_price">Giá bán lại (Coins)</label>
              <input id="sell_price" name="sell_price" type="number" min={0} defaultValue={e ? Number.parseInt(e.sell_price, 10) : 0} style={{ width: 140 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="icon_url">Link icon</label>
              <input id="icon_url" name="icon_url" type="text" defaultValue={e?.icon_url ?? ""} style={{ width: 240 }} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="description">Mô tả</label>
            <textarea id="description" name="description" rows={2} defaultValue={e?.description ?? ""} style={{ maxWidth: 640 }} />
          </div>
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={e?.enabled ?? true} />
            <span>Đang bật</span>
          </label>
          <button className="btn" type="submit">
            {e ? "Lưu item" : "Thêm item"}
          </button>
          {e ? (
            <Link href="/admin/items" style={{ marginLeft: 14 }}>
              Huỷ sửa
            </Link>
          ) : null}
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Danh sách item ({rows?.length ?? 0})</h2>
        {rows && rows.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Nhóm</th>
                <th>Giá Coins</th>
                <th>Giá Gems</th>
                <th>Bán lại</th>
                <th>Bật</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{catLabel(r.category)}</td>
                  <td>{fmt(r.price_coins)}</td>
                  <td>{fmt(r.price_gems)}</td>
                  <td>{fmt(r.sell_price)}</td>
                  <td>{r.enabled ? "Bật" : "Tắt"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link href={`/admin/items?edit=${r.id}`}>Sửa</Link>{" "}
                    <form action="/api/admin/game/items" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="toggle" />
                      <input type="hidden" name="id" value={r.id} />
                      {r.enabled ? null : <input type="hidden" name="enabled" value="on" />}
                      <button className="btn secondary sm" type="submit">
                        {r.enabled ? "Tắt" : "Bật"}
                      </button>
                    </form>{" "}
                    <form action="/api/admin/game/items" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn secondary sm" type="submit">
                        Xoá
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Chưa có item nào trong nhóm này.</p>
        )}
      </div>
    </>
  );
}
