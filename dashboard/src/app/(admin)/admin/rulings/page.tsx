import Link from "next/link";
import { adminGate } from "@/lib/current-session";
import { listGameSets } from "@/lib/db";
import { listRulingsAdmin } from "@/lib/rulings";
import { SHOP_GAMES } from "@/lib/shop";
import VerifyForm from "../verify-form";

export const dynamic = "force-dynamic";

const SCOPE_LABEL = { species: "Loài", set: "Bộ", game: "Game" } as const;

export default async function AdminRulingsPage({
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
  const [rows, sets] = await Promise.all([
    listRulingsAdmin().catch(() => []),
    listGameSets().catch(() => []),
  ]);
  const editing = edit ? rows.find((r) => r.id === Number.parseInt(edit, 10)) : undefined;
  const e = editing;

  return (
    <>
      <h1>Rulings — phán quyết chính thức</h1>
      {saved ? <div className="notice ok">Đã lưu ruling.</div> : null}
      {err ? <div className="notice">Không thực hiện được: {err}</div> : null}
      <p style={{ maxWidth: 780, lineHeight: 1.6 }}>
        Ruling do chủ bot nhập tay từ nguồn chính thức, gắn đúng một phạm vi:
        một loài thẻ, một bộ, hoặc cả một game. Trang chi tiết thẻ hiện ruling
        của loài trước, rồi của bộ, rồi của game.
      </p>

      <div className="panel">
        <h2>{e ? `Sửa ruling #${e.id}` : "Thêm ruling"}</h2>
        <form action="/api/admin/rulings" method="post">
          <input type="hidden" name="action" value="save" />
          {e ? <input type="hidden" name="id" value={e.id} /> : null}
          <div className="field">
            <label htmlFor="f-species">Mã loài (gắn theo loài)</label>
            <input id="f-species" name="species_id" defaultValue={e?.speciesId ?? ""} placeholder="vd: op01-096" />
          </div>
          <div className="field">
            <label htmlFor="f-set">Bộ thẻ (gắn theo bộ)</label>
            <select id="f-set" name="set_id" defaultValue={e?.setId ?? ""}>
              <option value="">— Không gắn bộ —</option>
              {sets.map((s) => (
                <option key={s.id} value={s.id}>{s.id} — {s.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-game">Game (gắn theo game)</label>
            <select id="f-game" name="game_prefix" defaultValue={e?.gamePrefix ?? ""}>
              <option value="">— Không gắn game —</option>
              {SHOP_GAMES.map((g) => (
                <option key={g.prefix} value={g.prefix}>{g.name}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="f-title">Tiêu đề</label>
            <input id="f-title" name="title" required maxLength={120} defaultValue={e?.title ?? ""} />
          </div>
          <div className="field">
            <label htmlFor="f-source">Nguồn (tuỳ chọn)</label>
            <input id="f-source" name="source" maxLength={300} defaultValue={e?.source ?? ""} placeholder="vd: One Piece Card Game — Official Rule Manual" />
          </div>
          <div className="field">
            <label htmlFor="f-body">Nội dung ruling</label>
            <textarea id="f-body" name="body" required rows={5} maxLength={4000} defaultValue={e?.body ?? ""} style={{ width: "100%" }} />
          </div>
          <div style={{ marginTop: 12, display: "flex", gap: 8 }}>
            <button className="btn" type="submit">{e ? "Lưu thay đổi" : "Thêm ruling"}</button>
            {e ? <Link className="btn secondary" href="/admin/rulings">Huỷ sửa</Link> : null}
          </div>
        </form>
      </div>

      <div className="panel">
        <h2>Đã có ({rows.length})</h2>
        {rows.length === 0 ? (
          <p>Chưa có ruling nào.</p>
        ) : (
          <table className="plain">
            <thead>
              <tr><th>Phạm vi</th><th>Gắn với</th><th>Tiêu đề</th><th>Cập nhật</th><th></th></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td>{SCOPE_LABEL[r.scope]}</td>
                  <td><code>{r.speciesId ?? r.setId ?? r.gamePrefix}</code></td>
                  <td>{r.title}</td>
                  <td>{new Date(r.updatedAt).toLocaleDateString("vi-VN")}</td>
                  <td style={{ whiteSpace: "nowrap" }}>
                    <Link className="btn small" href={`/admin/rulings?edit=${r.id}`}>Sửa</Link>{" "}
                    <form action="/api/admin/rulings" method="post" style={{ display: "inline" }}>
                      <input type="hidden" name="action" value="delete" />
                      <input type="hidden" name="id" value={r.id} />
                      <button className="btn small danger" type="submit">Xoá</button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
