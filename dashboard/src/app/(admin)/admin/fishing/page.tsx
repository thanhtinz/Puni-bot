import Link from "next/link";
import { adminGate } from "@/lib/current-session";
import { getBotConfig, listFish, listRods, type FishRow, type RodRow } from "@/lib/db";
import { FISH_RARITIES, FISH_RARITY_LABELS, normalizeFishingConfig } from "@/lib/fishing";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

export default async function AdminFishingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; verify?: string; editFish?: string; editRod?: string }>;
}) {
  const gate = await adminGate();
  const { saved, verify, editFish: editFishId, editRod: editRodId } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const cfg = normalizeFishingConfig(await getBotConfig("fishing_config").catch(() => null));
  const fishList = await listFish().catch(() => null);
  const rodList = await listRods().catch(() => null);
  const editFish: FishRow | null = fishList?.find((f) => f.id === editFishId) ?? null;
  const editRod: RodRow | null = rodList?.find((r) => r.id === editRodId) ?? null;
  const totalWeight = FISH_RARITIES.reduce((s, k) => s + cfg.weights[k], 0);

  return (
    <>
      <h1>Câu cá — cấu hình hệ thống</h1>
      {saved ? <div className="notice ok">Đã lưu — bot áp dụng ngay cho lượt câu tiếp theo.</div> : null}
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Người chơi dùng lệnh <strong>/fish</strong>: roll bậc cá theo trọng số, cá tự
        bán lấy Coins theo khoảng giá của bậc. Tên cá lấy ngẫu nhiên từ nhóm{" "}
        <Link href="/admin/items?cat=fish">Cá trong mục Item</Link>. Trần tiền mỗi
        ngày chống lạm phát — tính từ sổ cái economy.
      </p>

      <form action="/api/admin/fishing" method="post">
        <div className="panel">
          <h2>Vận hành</h2>
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={cfg.enabled} />
            <span>Bật hệ thống câu cá</span>
          </label>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="cooldown">Chờ giữa 2 lượt câu (giây)</label>
              <input id="cooldown" name="cooldown" type="number" min={0} max={3600} defaultValue={cfg.cooldownSec} style={{ width: 140 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="daily_cap">Trần Coins/ngày/người (0 = không trần)</label>
              <input id="daily_cap" name="daily_cap" type="number" min={0} defaultValue={cfg.dailyCap} style={{ width: 180 }} />
            </div>
          </div>
        </div>

        <div className="panel" style={{ maxWidth: 900 }}>
          <h2>Bậc cá: trọng số & giá bán</h2>
          <p>
            Trọng số là tỉ lệ tương đối (tổng hiện tại {totalWeight}) — ví dụ huyền
            thoại 1/{totalWeight} lượt. Giá bán mỗi con roll đều trong khoảng
            nhỏ nhất–lớn nhất.
          </p>
          <table className="plain">
            <thead>
              <tr>
                <th>Bậc cá</th>
                <th>Trọng số</th>
                <th>Tỉ lệ</th>
                <th>Giá nhỏ nhất</th>
                <th>Giá lớn nhất</th>
              </tr>
            </thead>
            <tbody>
              {FISH_RARITIES.map((k) => (
                <tr key={k}>
                  <td>{FISH_RARITY_LABELS[k]}</td>
                  <td>
                    <input name={`w_${k}`} type="number" min={0} defaultValue={cfg.weights[k]} style={{ width: 100 }} />
                  </td>
                  <td>{totalWeight > 0 ? ((cfg.weights[k] / totalWeight) * 100).toFixed(1) : "0"}%</td>
                  <td>
                    <input name={`min_${k}`} type="number" min={0} defaultValue={cfg.priceMin[k]} style={{ width: 120 }} />
                  </td>
                  <td>
                    <input name={`max_${k}`} type="number" min={0} defaultValue={cfg.priceMax[k]} style={{ width: 120 }} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button className="btn" type="submit" style={{ marginTop: 16 }}>
            Lưu cấu hình câu cá
          </button>
        </div>
      </form>

      <div className="panel">
        <h2>{editFish ? `Sửa cá: ${editFish.name}` : "Thêm cá"}</h2>
        <form action="/api/admin/game/fish" method="post">
          <input type="hidden" name="action" value="save" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="fid">Mã cá (slug)</label>
              <input id="fid" name="id" type="text" required defaultValue={editFish?.id ?? ""} readOnly={Boolean(editFish)} placeholder="ca-chep-vang" style={{ width: 180 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="fname">Tên cá</label>
              <input id="fname" name="name" type="text" required defaultValue={editFish?.name ?? ""} style={{ width: 220 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="frarity">Bậc hiếm</label>
              <select id="frarity" name="rarity" defaultValue={editFish?.rarity ?? "common"}>
                {FISH_RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {FISH_RARITY_LABELS[r]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="field">
            <label htmlFor="fdesc">Mô tả</label>
            <textarea id="fdesc" name="description" rows={2} defaultValue={editFish?.description ?? ""} style={{ maxWidth: 640 }} />
          </div>
          <label className="check">
            <input type="checkbox" name="member_exclusive" defaultChecked={editFish?.member_exclusive ?? false} />
            <span>Chỉ hội viên Membership mới câu được</span>
          </label>
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={editFish ? editFish.enabled : true} />
            <span>Đang bật</span>
          </label>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button className="btn" type="submit">
              {editFish ? "Lưu cá" : "Thêm cá"}
            </button>
            {editFish ? (
              <a className="btn secondary" href="/admin/fishing">
                Huỷ sửa
              </a>
            ) : null}
          </div>
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Kho cá ({fishList?.length ?? 0})</h2>
        {fishList && fishList.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Bậc</th>
                <th>Hội viên</th>
                <th>Bật</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {fishList.map((f) => (
                <tr key={f.id}>
                  <td>{f.id}</td>
                  <td>{f.name}</td>
                  <td>{FISH_RARITY_LABELS[f.rarity as keyof typeof FISH_RARITY_LABELS] ?? f.rarity}</td>
                  <td>{f.member_exclusive ? "Riêng hội viên" : "—"}</td>
                  <td>{f.enabled ? "Bật" : "Tắt"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a href={`/admin/fishing?editFish=${f.id}`}>Sửa</a>{" "}
                    <form action="/api/admin/game/fish" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="toggle" />
                      <input type="hidden" name="id" value={f.id} />
                      <input type="hidden" name="enabled" value={f.enabled ? "0" : "1"} />
                      <button className="btn secondary sm" type="submit">
                        {f.enabled ? "Tắt" : "Bật"}
                      </button>
                    </form>{" "}
                    <form action="/api/admin/game/fish" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={f.id} />
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
          <p>Chưa có cá nào (hoặc bảng game_fish chưa được tạo — chạy migration 0013). Lệnh fish đang dùng tên cá dự phòng theo bậc.</p>
        )}
      </div>

      <div className="panel">
        <h2>{editRod ? `Sửa cần: ${editRod.name}` : "Thêm cần câu"}</h2>
        <form action="/api/admin/game/rods" method="post">
          <input type="hidden" name="action" value="save" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="rid">Mã cần (slug)</label>
              <input id="rid" name="id" type="text" required defaultValue={editRod?.id ?? ""} readOnly={Boolean(editRod)} placeholder="can-tre" style={{ width: 180 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="rname">Tên cần</label>
              <input id="rname" name="name" type="text" required defaultValue={editRod?.name ?? ""} style={{ width: 220 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="rcoinc">Giá (Coins)</label>
              <input id="rcoinc" name="price_coins" type="number" min={0} defaultValue={editRod?.price_coins ?? 0} style={{ width: 140 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="rgem">Giá (Gems)</label>
              <input id="rgem" name="price_gems" type="number" min={0} defaultValue={editRod?.price_gems ?? 0} style={{ width: 140 }} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 10 }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="rbonus">Cộng % trọng số cá hiếm trở lên (0–500)</label>
              <input id="rbonus" name="rare_bonus_percent" type="number" min={0} max={500} defaultValue={editRod?.rare_bonus_percent ?? 0} style={{ width: 130 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="rcd">Thời gian chờ % (100 = như thường, 50 = nhanh gấp đôi)</label>
              <input id="rcd" name="cooldown_percent" type="number" min={10} max={200} defaultValue={editRod?.cooldown_percent ?? 100} style={{ width: 130 }} />
            </div>
          </div>
          <div className="field">
            <label htmlFor="rdesc">Mô tả</label>
            <textarea id="rdesc" name="description" rows={2} defaultValue={editRod?.description ?? ""} style={{ maxWidth: 640 }} />
          </div>
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={editRod ? editRod.enabled : true} />
            <span>Đang bật (mở bán/trang bị khi túi đồ game mở)</span>
          </label>
          <div style={{ marginTop: 12, display: "flex", gap: 10 }}>
            <button className="btn" type="submit">
              {editRod ? "Lưu cần" : "Thêm cần"}
            </button>
            {editRod ? (
              <a className="btn secondary" href="/admin/fishing">
                Huỷ sửa
              </a>
            ) : null}
          </div>
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Kho cần câu ({rodList?.length ?? 0})</h2>
        {rodList && rodList.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Mã</th>
                <th>Tên</th>
                <th>Giá</th>
                <th>Bonus hiếm</th>
                <th>Chờ</th>
                <th>Bật</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rodList.map((r) => (
                <tr key={r.id}>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>
                    {Number.parseInt(r.price_coins, 10).toLocaleString("vi-VN")} Coins
                    {Number.parseInt(r.price_gems, 10) > 0 ? ` · ${Number.parseInt(r.price_gems, 10).toLocaleString("vi-VN")} Gems` : ""}
                  </td>
                  <td>+{r.rare_bonus_percent}%</td>
                  <td>{r.cooldown_percent}%</td>
                  <td>{r.enabled ? "Bật" : "Tắt"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <a href={`/admin/fishing?editRod=${r.id}`}>Sửa</a>{" "}
                    <form action="/api/admin/game/rods" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="toggle" />
                      <input type="hidden" name="id" value={r.id} />
                      <input type="hidden" name="enabled" value={r.enabled ? "0" : "1"} />
                      <button className="btn secondary sm" type="submit">
                        {r.enabled ? "Tắt" : "Bật"}
                      </button>
                    </form>{" "}
                    <form action="/api/admin/game/rods" method="post" style={{ display: "inline" }}>
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
          <p>Chưa có cần câu nào (hoặc bảng game_rods chưa được tạo — chạy migration 0013).</p>
        )}
      </div>
    </>
  );
}
