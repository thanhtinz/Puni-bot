import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { deleteRod, setRodEnabled, upsertRod } from "@/lib/db";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const num = (v: FormDataEntryValue | null, max: number) =>
  Math.min(max, Math.max(0, Number.parseInt(String(v ?? "0"), 10) || 0));

/** Fishing rod catalogue actions (Admin → Câu cá). Exact match only. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const id = String(form.get("id") ?? "").trim();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/fishing?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));
  try {
    if (action === "save") {
      const name = String(form.get("name") ?? "").trim().slice(0, 80);
      if (!SLUG.test(id)) return fail("Mã cần phải là slug chữ thường, số, dấu gạch ngang (2–41 ký tự).");
      if (!name) return fail("Thiếu tên cần câu.");
      await upsertRod({
        id,
        name,
        priceCoins: num(form.get("price_coins"), 1_000_000_000),
        priceGems: num(form.get("price_gems"), 1_000_000_000),
        rareBonusPercent: num(form.get("rare_bonus_percent"), 500),
        cooldownPercent: Math.min(200, Math.max(10, Number.parseInt(String(form.get("cooldown_percent") ?? "100"), 10) || 100)),
        description: String(form.get("description") ?? "").trim().slice(0, 300),
        enabled: form.get("enabled") != null,
      });
      return back("saved=1");
    }
    if (action === "delete") {
      if (!SLUG.test(id)) return fail("Mã cần không hợp lệ.");
      await deleteRod(id);
      return back("saved=1");
    }
    if (action === "toggle") {
      if (!SLUG.test(id)) return fail("Mã cần không hợp lệ.");
      await setRodEnabled(id, form.get("enabled") === "1");
      return back("saved=1");
    }
    return fail("Thao tác không hợp lệ.");
  } catch {
    return fail("Lỗi cơ sở dữ liệu — kiểm tra migration 0013 đã chạy chưa.");
  }
}
