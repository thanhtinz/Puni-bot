import Link from "next/link";
import { adminGate } from "@/lib/current-session";
import { getBotConfig } from "@/lib/db";
import { FISH_RARITIES, FISH_RARITY_LABELS, normalizeFishingConfig } from "@/lib/fishing";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

export default async function AdminFishingPage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; verify?: string }>;
}) {
  const gate = await adminGate();
  const { saved, verify } = await searchParams;
  if (!gate.ok) {
    if (gate.reason === "need-verify") return <VerifyForm error={verify === "failed"} />;
    return null;
  }
  const cfg = normalizeFishingConfig(await getBotConfig("fishing_config").catch(() => null));
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
    </>
  );
}
