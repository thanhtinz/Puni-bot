import { redirect } from "next/navigation";
import { adminGate } from "@/lib/current-session";
import { getBotConfig, listCrops, type CropRow } from "@/lib/db";
import { normalizeFarmConfig } from "@/lib/farm";

export const dynamic = "force-dynamic";

const fmt = (n: string) => Number.parseInt(n, 10).toLocaleString("vi-VN");

export default async function AdminFarmPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; err?: string; edit?: string }>;
}) {
  const gate = await adminGate();
  if (!gate.ok && gate.reason === "not-owner") redirect("/dashboard");
  if (!gate.ok) redirect("/admin");
  const sp = await searchParams;
  const cfg = normalizeFarmConfig(await getBotConfig("farm_config").catch(() => null));
  const crops = await listCrops().catch(() => null);
  const editing: CropRow | null =
    crops?.find((c) => c.id === sp.edit) ?? null;

  return (
    <>
      <h1>Nông trại — cây trồng &amp; cấu hình</h1>
      {sp.saved ? <div className="notice ok">Đã lưu thay đổi nông trại.</div> : null}
      {sp.err ? <div className="notice">Không thực hiện được: {sp.err}</div> : null}
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Cây trồng có vòng đời riêng (gieo hạt → chờ lớn → thu hoạch) nên quản lý
        tại đây; dụng cụ và nguyên liệu nông trại nằm ở mục Item. Gameplay gieo
        trồng theo ô đất của từng người chơi mở cùng giai đoạn game — dữ liệu
        cây và cấu hình dưới đây là phần quản lý có hiệu lực ngay.
      </p>

      <div className="panel">
        <h2>Cấu hình nông trại</h2>
        <form action="/api/admin/farm-config" method="post">
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} />
            <span>Bật hệ thống nông trại</span>
          </label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="default_plots">Số ô đất mặc định / người</label>
              <input id="default_plots" name="default_plots" type="number" min={1} max={60} defaultValue={cfg.defaultPlots} style={{ maxWidth: 130 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="member_extra_plots">Ô đất cộng thêm cho hội viên</label>
              <input id="member_extra_plots" name="member_extra_plots" type="number" min={0} max={60} defaultValue={cfg.memberExtraPlots} style={{ maxWidth: 130 }} />
            </div>
          </div>
          <div style={{ marginTop: 14 }}>
            <button className="btn" type="submit">
              Lưu cấu hình
            </button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>{editing ? `Sửa cây: ${editing.name}` : "Thêm cây trồng"}</h2>
        <form action="/api/admin/game/crops" method="post">
          <input type="hidden" name="action" value="save" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="cid">Mã cây (slug)</label>
              <input id="cid" name="id" type="text" required defaultValue={editing?.id ?? ""} readOnly={Boolean(editing)} placeholder="ca-chua" style={{ width: 180 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="cname">Tên cây</label>
              <input id="cname" name="name" type="text" required defaultValue={editing?.name ?? ""} style={{ width: 220 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="cgrow">Thời gian lớn (phút)</label>
              <input id="cgrow" name="grow_minutes" type="number" min={1} max={43200} defaultValue={editing?.grow_minutes ?? 60} style={{ width: 130 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="cseedc">Giá hạt (Coins)</label>
              <input id="cseedc" name="seed_price_coins" type="number" min={0} defaultValue={editing?.seed_price_coins ?? 0} style={{ width: 140 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="cseedg">Giá hạt (Gems)</label>
              <input id="cseedg" name="seed_price_gems" type="number" min={0} defaultValue={editing?.seed_price_gems ?? 0} style={{ width: 140 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="cymin">Thu hoạch ít nhất</label>
              <input id="cymin" name="yield_min" type="number" min={1} max={100} defaultValue={editing?.yield_min ?? 1} style={{ width: 110 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="cymax">Thu hoạch nhiều nhất</label>
              <input id="cymax" name="yield_max" type="number" min={1} max={100} defaultValue={editing?.yield_max ?? 2} style={{ width: 110 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="csell">Giá bán / đơn vị (Coins)</label>
              <input id="csell" name="sell_price" type="number" min={0} defaultValue={editing?.sell_price ?? 0} style={{ width: 150 }} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="cdesc">Mô tả</label>
            <textarea id="cdesc" name="description" rows={2} defaultValue={editing?.description ?? ""} style={{ maxWidth: 640 }} />
          </div>
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={editing ? editing.enabled : true} />
            <span>Đang bật (tắt = ẩn khỏi nông trại)</span>
          </label>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button className="btn" type="submit">
              {editing ? "Lưu cây" : "Thêm cây"}
            </button>
            {editing ? (
              <a className="btn secondary" href="/admin/farm">
                Huỷ sửa
              </a>
            ) : null}
          </div>
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Danh sách cây trồng ({crops?.length ?? 0})</h2>
        {crops && crops.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Giá hạt</th>
                <th>Lớn trong</th>
                <th>Thu hoạch</th>
                <th>Giá bán</th>
                <th>Bật</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => (
                <tr key={c.id}>
                  <td>{c.id}</td>
                  <td>{c.name}</td>
                  <td>
                    {fmt(c.seed_price_coins)} Coins
                    {Number.parseInt(c.seed_price_gems, 10) > 0 ? ` · ${fmt(c.seed_price_gems)} Gems` : ""}
                  </td>
                  <td>{c.grow_minutes} phút</td>
                  <td>
                    {c.yield_min}–{c.yield_max}
                  </td>
                  <td>{fmt(c.sell_price)} Coins</td>
                  <td>{c.enabled ? "Bật" : "Tắt"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a href={`/admin/farm?edit=${c.id}`}>Sửa</a>{" "}
                    <form action="/api/admin/game/crops" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="toggle" />
                      <input type="hidden" name="id" value={c.id} />
                      <input type="hidden" name="enabled" value={c.enabled ? "0" : "1"} />
                      <button className="btn secondary sm" type="submit">
                        {c.enabled ? "Tắt" : "Bật"}
                      </button>
                    </form>{" "}
                    <form action="/api/admin/game/crops" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={c.id} />
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
          <p>Chưa có cây trồng nào (hoặc bảng game_crops chưa được tạo — chạy migration 0013).</p>
        )}
      </div>
    </>
  );
}
