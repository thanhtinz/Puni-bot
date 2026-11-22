import Link from "next/link";
import { adminGate } from "@/lib/current-session";
import { listGameSets, listSpecies, type SpeciesRow } from "@/lib/db";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

const RARITIES = ["Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Fabled"];

export default async function AdminPetsPage({
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
  const rows = await listSpecies().catch(() => null);
  const sets = await listGameSets().catch(() => []);
  const editing: SpeciesRow | undefined = edit ? rows?.find((r) => r.id === edit) : undefined;
  const e = editing;

  return (
    <>
      <h1>Quản lý loài thẻ</h1>
      {saved ? <div className="notice ok">Đã lưu thay đổi pet.</div> : null}
      {err ? <div className="notice">Không thực hiện được: {err}</div> : null}
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Kho loài của game nằm ở đây — game đọc thẳng từ bảng này, không hardcode
        danh sách loài. Mỗi loài thuộc về đúng một BỘ thẻ; Tuxemon chỉ là bộ đầu
        tiên, thêm bộ mới ở panel Bộ thẻ bên dưới. (Loài Tuxemon kèm ảnh sprite —
        dữ liệu và hình ảnh của dự án Tuxemon, giấy phép CC-BY-SA, giữ credit khi dùng.)
      </p>

      <div className="panel">
        <h2>Bộ thẻ</h2>
        {sets.length === 0 ? (
          <p>Chưa có bộ nào (cần chạy migration 0020).</p>
        ) : (
          <table className="plain">
            <thead>
              <tr><th>Mã bộ</th><th>Tên bộ</th><th>Số loài</th><th>Thứ tự</th><th>Đang bật</th><th></th></tr>
            </thead>
            <tbody>
              {sets.map((s) => (
                <tr key={s.id}>
                  <td><code>{s.id}</code></td>
                  <td>{s.name}</td>
                  <td>{s.species_count}</td>
                  <td>{s.sort}</td>
                  <td>{s.enabled ? "Có" : "Không"}</td>
                  <td>
                    <form action="/api/admin/game/sets" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={s.id} />
                      <button className="btn small danger" type="submit">Xoá</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <form action="/api/admin/game/sets" method="post" style={{ marginTop: 14 }}>
          <input type="hidden" name="action" value="save" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="set-id">Mã bộ (slug)</label>
              <input id="set-id" name="id" type="text" required placeholder="bo-2" style={{ width: 150 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="set-name">Tên bộ</label>
              <input id="set-name" name="name" type="text" required style={{ width: 220 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="set-sort">Thứ tự</label>
              <input id="set-sort" name="sort" type="number" defaultValue={0} style={{ width: 90 }} />
            </div>
          </div>
          <div className="field" style={{ marginTop: 10 }}>
            <label htmlFor="set-desc">Mô tả</label>
            <input id="set-desc" name="description" type="text" style={{ width: "100%" }} />
          </div>
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked />
            <span>Bật bộ này</span>
          </label>
          <div style={{ marginTop: 10 }}>
            <button className="btn" type="submit">Lưu bộ thẻ</button>
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>{e ? `Sửa pet: ${e.name}` : "Thêm pet mới"}</h2>
        <form action="/api/admin/game/species" method="post">
          <input type="hidden" name="action" value="save" />
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="id">Mã pet (slug)</label>
              <input id="id" name="id" type="text" required defaultValue={e?.id ?? ""} placeholder="rockitten" style={{ width: 200 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="name">Tên pet</label>
              <input id="name" name="name" type="text" required defaultValue={e?.name ?? ""} style={{ width: 240 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="types">Hệ (cách nhau dấu phẩy)</label>
              <input id="types" name="types" type="text" defaultValue={e?.types ?? ""} placeholder="Đất, Lửa" style={{ width: 200 }} />
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="set_id">Bộ thẻ</label>
              <select id="set_id" name="set_id" defaultValue={e?.set_id ?? "tuxemon"}>
                {sets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
                {sets.length === 0 && <option value="tuxemon">Bộ Tuxemon</option>}
              </select>
            </div>
            <div className="field" style={{ margin: 0 }}>
              <label htmlFor="rarity">Độ hiếm</label>
              <select id="rarity" name="rarity" defaultValue={e?.rarity ?? "Common"}>
                {RARITIES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginTop: 12 }}>
            {(
              [
                ["base_hp", "HP gốc"],
                ["base_atk", "Tấn công gốc"],
                ["base_def", "Phòng thủ gốc"],
                ["base_spd", "Tốc độ gốc"],
              ] as const
            ).map(([name, label]) => (
              <div className="field" key={name} style={{ margin: 0 }}>
                <label htmlFor={name}>{label}</label>
                <input id={name} name={name} type="number" min={1} max={999} defaultValue={e?.[name] ?? 50} style={{ width: 110 }} />
              </div>
            ))}
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="sprite_url">Link ảnh sprite</label>
            <input id="sprite_url" name="sprite_url" type="text" defaultValue={e?.sprite_url ?? ""} style={{ maxWidth: 560 }} />
          </div>
          <div className="field">
            <label htmlFor="description">Mô tả</label>
            <textarea id="description" name="description" rows={2} defaultValue={e?.description ?? ""} style={{ maxWidth: 640 }} />
          </div>
          <label className="check">
            <input type="checkbox" name="member_exclusive" defaultChecked={e?.member_exclusive ?? false} />
            <span>Chỉ hội viên Membership mới săn/bắt được</span>
          </label>
          <label className="check">
            <input type="checkbox" name="enabled" defaultChecked={e?.enabled ?? true} />
            <span>Đang bật (tắt = ẩn khỏi game)</span>
          </label>
          <button className="btn" type="submit">
            {e ? "Lưu pet" : "Thêm pet"}
          </button>
          {e ? (
            <Link href="/admin/pets" style={{ marginLeft: 14 }}>
              Huỷ sửa
            </Link>
          ) : null}
        </form>
      </div>

      <div className="panel" style={{ maxWidth: 1080 }}>
        <h2>Danh sách pet ({rows?.length ?? 0})</h2>
        {rows && rows.length > 0 ? (
          <table className="plain">
            <thead>
              <tr>
                <th>Ảnh</th>
                <th>Mã</th>
                <th>Tên</th>
                <th>Hệ</th>
                <th>Hiếm</th>
                <th>HP/ATK/DEF/SPD</th>
                <th>Hội viên</th>
                <th>Bật</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>
                    {r.sprite_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={r.sprite_url} alt={r.name} width={44} height={44} style={{ objectFit: "contain", imageRendering: "pixelated" }} />
                    ) : (
                      "—"
                    )}
                  </td>
                  <td>{r.id}</td>
                  <td>{r.name}</td>
                  <td>{r.types || "—"}</td>
                  <td>{r.rarity}</td>
                  <td>
                    {r.base_hp}/{r.base_atk}/{r.base_def}/{r.base_spd}
                  </td>
                  <td>{r.member_exclusive ? "Riêng" : "—"}</td>
                  <td>{r.enabled ? "Bật" : "Tắt"}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link href={`/admin/pets?edit=${r.id}`}>Sửa</Link>{" "}
                    <form action="/api/admin/game/species" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="toggle" />
                      <input type="hidden" name="id" value={r.id} />
                      {r.enabled ? null : <input type="hidden" name="enabled" value="on" />}
                      <button className="btn secondary sm" type="submit">
                        {r.enabled ? "Tắt" : "Bật"}
                      </button>
                    </form>{" "}
                    <form action="/api/admin/game/species" method="post" style={{ display: "inline" }}>
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
          <p>Chưa có pet nào — thêm ở form trên, hoặc chờ đợt nhập dữ liệu Tuxemon ở GĐ9.</p>
        )}
      </div>
    </>
  );
}
