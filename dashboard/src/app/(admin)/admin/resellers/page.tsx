import { adminGate } from "@/lib/current-session";
import { shopApi, shopApiConfigured } from "@/lib/shop-api";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

interface Reseller {
  id: number;
  discordId: string;
  discountPercent: number;
  guildIds: string[];
  locked: boolean;
}

/** Reseller management — data lives in the Shop DB and is reached
 *  ONLY through the Shop bot API (spec 6.12); this panel never
 *  touches Shop tables directly. */
export default async function AdminResellersPage() {
  const gate = await adminGate();
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm />;
    return null;
  }
  if (!shopApiConfigured()) {
    return (
      <>
        <h1>Reseller</h1>
        <div className="notice">
          Chưa cấu hình SHOP_API_BASE_URL / SHOP_BOT_KEY cho Admin panel nên chưa gọi được API
          phía Shop.
        </div>
      </>
    );
  }
  let resellers: Reseller[] = [];
  let error: string | null = null;
  try {
    const data = await shopApi<{ resellers: Reseller[] }>("/resellers");
    resellers = data.resellers;
  } catch (e) {
    error = e instanceof Error ? e.message : "Không tải được danh sách reseller.";
  }
  return (
    <>
      <h1>Reseller</h1>
      {error && <div className="notice">{error}</div>}
      <div className="panel" style={{ background: "#1c1f27", borderColor: "#2b2f3a", color: "#e7eaf0" }}>
        <h2>Tạo reseller</h2>
        <form action="/api/admin/resellers" method="post">
          <div className="field">
            <label htmlFor="r-discord">Discord ID</label>
            <input id="r-discord" name="discordId" type="text" required />
          </div>
          <div className="field">
            <label htmlFor="r-percent">Chiết khấu % (0–90)</label>
            <input id="r-percent" name="discountPercent" type="text" defaultValue="10" required />
          </div>
          <div className="field">
            <label htmlFor="r-guilds">Guild được phép bán (mỗi ID một dòng, để trống = mọi guild)</label>
            <textarea id="r-guilds" name="guildIds" />
          </div>
          <button className="btn" type="submit">
            Tạo reseller
          </button>
        </form>
      </div>
      <table className="plain">
        <thead>
          <tr>
            <th>ID</th>
            <th>Discord ID</th>
            <th>Chiết khấu</th>
            <th>Guild</th>
            <th>Trạng thái</th>
          </tr>
        </thead>
        <tbody>
          {resellers.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.discordId}</td>
              <td>{r.discountPercent}%</td>
              <td>{r.guildIds.length ? r.guildIds.join(", ") : "(mọi guild)"}</td>
              <td>{r.locked ? "Đã khoá" : "Đang hoạt động"}</td>
            </tr>
          ))}
          {resellers.length === 0 && (
            <tr>
              <td colSpan={5}>Chưa có reseller nào.</td>
            </tr>
          )}
        </tbody>
      </table>
    </>
  );
}
