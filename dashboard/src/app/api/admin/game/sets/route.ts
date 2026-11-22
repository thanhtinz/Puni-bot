import { NextRequest, NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { deleteGameSet, upsertGameSet } from "@/lib/db";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;

/** Card set management (spec 6.27) — explicit action match only. */
export async function POST(req: NextRequest) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const back = (q: string) =>
    NextResponse.redirect(new URL(`/admin/pets?${q}`, req.nextUrl), 303);
  const id = String(form.get("id") ?? "").trim().toLowerCase();

  if (action === "save") {
    if (!SLUG.test(id)) return back("err=" + encodeURIComponent("Mã bộ phải là chữ thường/số/gạch ngang, 2–41 ký tự."));
    const name = String(form.get("name") ?? "").trim().slice(0, 80);
    if (!name) return back("err=" + encodeURIComponent("Thiếu tên bộ."));
    await upsertGameSet({
      id,
      name,
      description: String(form.get("description") ?? "").trim().slice(0, 300),
      sort: Number.parseInt(String(form.get("sort") ?? "0"), 10) || 0,
      enabled: form.get("enabled") != null,
    });
    return back("saved=1");
  }
  if (action === "delete") {
    if (!SLUG.test(id)) return back("err=" + encodeURIComponent("Mã bộ không hợp lệ."));
    const ok = await deleteGameSet(id);
    return back(ok ? "saved=1" : "err=" + encodeURIComponent("Bộ còn loài thuộc về — chuyển loài sang bộ khác trước khi xoá."));
  }
  return back("err=" + encodeURIComponent("Thao tác không hợp lệ."));
}
