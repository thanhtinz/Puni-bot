import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { deleteFish, setFishEnabled, upsertFish } from "@/lib/db";
import { FISH_RARITIES } from "@/lib/fishing";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const num = (v: FormDataEntryValue | null) =>
  Math.max(0, Number.parseInt(String(v ?? "0"), 10) || 0);

/** Fish catalogue actions (Admin → Câu cá). Exact action match only. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const id = String(form.get("id") ?? "").trim();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/fishing?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));
  void num;
  try {
    if (action === "save") {
      const name = String(form.get("name") ?? "").trim().slice(0, 80);
      const rarity = String(form.get("rarity") ?? "common");
      if (!SLUG.test(id)) return fail("Mã cá phải là slug chữ thường, số, dấu gạch ngang (2–41 ký tự).");
      if (!name) return fail("Thiếu tên cá.");
      if (!(FISH_RARITIES as readonly string[]).includes(rarity)) return fail("Bậc hiếm không hợp lệ.");
      await upsertFish({
        id,
        name,
        rarity,
        description: String(form.get("description") ?? "").trim().slice(0, 300),
        member_exclusive: form.get("member_exclusive") != null,
        enabled: form.get("enabled") != null,
      });
      return back("saved=1");
    }
    if (action === "delete") {
      if (!SLUG.test(id)) return fail("Mã cá không hợp lệ.");
      await deleteFish(id);
      return back("saved=1");
    }
    if (action === "toggle") {
      if (!SLUG.test(id)) return fail("Mã cá không hợp lệ.");
      await setFishEnabled(id, form.get("enabled") === "1");
      return back("saved=1");
    }
    return fail("Thao tác không hợp lệ.");
  } catch {
    return fail("Lỗi cơ sở dữ liệu — kiểm tra migration 0013 đã chạy chưa.");
  }
}
