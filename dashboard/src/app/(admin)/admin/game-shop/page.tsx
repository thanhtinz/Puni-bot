import { adminGate } from "@/lib/current-session";
import { listItems, listShopListings } from "@/lib/db";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

const fmt = (n: string) => Number.parseInt(n, 10).toLocaleString("vi-VN");

export default async function AdminGameShopPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; err?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { saved, err, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const items = (await listItems().catch(() => null)) ?? [];
  const listings = await listShopListings().catch(() => null);

  return (
    <>
      <h1>Shop trong game — Cozy World</h1>
      {saved ? <div className="notice ok">Đã lưu thay đổi shop.</div> : null}
      {err ? <div className="notice">Không thực hiện được: {err}</div> : null}
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Đây là shop TRONG GAME Cozy World (bán item bằng Coins/Gems của game) —
        không liên quan hệ thống bán hàng bên ngoài. Chọn item để đưa lên kệ,
        giá để trống thì dùng giá gốc của item.
      </p>

      <div className="panel">
        <h2>Đưa item lên kệ / sửa niêm yết</h2>
        <form action="/api/admin/game/shop" method="post">
          <input type="hidden" name="action" value="save" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", alignItems: "end" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="item_id">Item</label>
              <select id="item_id" name="item_id" required style={{ minWidth: 240 }}>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.name} ({i.id})
                  </option>
                ))}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="price_coins">Giá Coins (trống = giá gốc)</label>
              <input id="price_coins" name="price_coins" type="number" min={0} style={{ width: 150 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="price_gems">Giá Gems (trống = giá gốc)</label>
              <input id="price_gems" name="price_gems" type="number" min={0} style={{ width: 150 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="stock">Tồn kho (trống = vô hạn)</label>
              <input id="stock" name="stock" type="number" min={0} style={{ width: 130 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="sort">Thứ tự</label>
              <input id="sort" name="sort" type="number" min={0} defaultValue={0} style={{ width: 90 }} />
            </div>
          </div>
          <label className="check" style={{ marginTop: 12 }}>
            <input type="checkbox" name="enabled" defaultChecked />
            <span>Đang bày bán</span>
          </label>
          <button className="btn" type="submit">
            Lưu niêm yết
          </button>
        </form>
        {items.length === 0 ? <p>Chưa có item nào — tạo item ở mục Item trước.</p> : null}
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Đang niêm yết ({listings?.length ?? 0})</h2>
        {listings && listings.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Item</th>
                <th>Giá Coins</th>
                <th>Giá Gems</th>
                <th>Tồn kho</th>
                <th>Thứ tự</th>
                <th>Bán</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {listings.map((l) => (
                <tr key={l.id}>
                  <td>{l.item_name}</td>
                  <td>{l.price_coins != null ? fmt(l.price_coins) : `${fmt(l.item_price_coins)} (gốc)`}</td>
                  <td>{l.price_gems != null ? fmt(l.price_gems) : `${fmt(l.item_price_gems)} (gốc)`}</td>
                  <td>{l.stock == null ? "Vô hạn" : l.stock}</td>
                  <td>{l.sort}</td>
                  <td>{l.enabled ? "Đang bán" : "Ngừng"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <form action="/api/admin/game/shop" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="toggle" />
                      <input type="hidden" name="id" value={l.id} />
                      {l.enabled ? null : <input type="hidden" name="enabled" value="on" />}
                      <button className="btn secondary sm" type="submit">
                        {l.enabled ? "Ngừng" : "Bán lại"}
                      </button>
                    </form>{" "}
                    <form action="/api/admin/game/shop" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={l.id} />
                      <button className="btn secondary sm" type="submit">
                        Gỡ khỏi kệ
                      </button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p>Chưa có item nào trên kệ.</p>
        )}
      </div>
    </>
  );
}
