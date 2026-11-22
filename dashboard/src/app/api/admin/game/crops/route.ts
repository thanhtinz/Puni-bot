import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { deleteCrop, setCropEnabled, upsertCrop } from "@/lib/db";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;
const num = (v: FormDataEntryValue | null, max: number, min = 0) =>
  Math.min(max, Math.max(min, Number.parseInt(String(v ?? "0"), 10) || 0));

/** Crop catalogue actions (Admin → Nông trại). Exact match only. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const id = String(form.get("id") ?? "").trim();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/farm?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));
  try {
    if (action === "save") {
      const name = String(form.get("name") ?? "").trim().slice(0, 80);
      if (!SLUG.test(id)) return fail("Mã cây phải là slug chữ thường, số, dấu gạch ngang (2–41 ký tự).");
      if (!name) return fail("Thiếu tên cây.");
      const yieldMin = num(form.get("yield_min"), 100, 1);
      const yieldMax = Math.max(yieldMin, num(form.get("yield_max"), 100, 1));
      await upsertCrop({
        id,
        name,
        seedPriceCoins: num(form.get("seed_price_coins"), 1_000_000_000),
        seedPriceGems: num(form.get("seed_price_gems"), 1_000_000_000),
        growMinutes: num(form.get("grow_minutes"), 43_200, 1),
        yieldMin,
        yieldMax,
        sellPrice: num(form.get("sell_price"), 1_000_000_000),
        description: String(form.get("description") ?? "").trim().slice(0, 300),
        enabled: form.get("enabled") != null,
      });
      return back("saved=1");
    }
    if (action === "delete") {
      if (!SLUG.test(id)) return fail("Mã cây không hợp lệ.");
      await deleteCrop(id);
      return back("saved=1");
    }
    if (action === "toggle") {
      if (!SLUG.test(id)) return fail("Mã cây không hợp lệ.");
      await setCropEnabled(id, form.get("enabled") === "1");
      return back("saved=1");
    }
    return fail("Thao tác không hợp lệ.");
  } catch {
    return fail("Lỗi cơ sở dữ liệu — kiểm tra migration 0013 đã chạy chưa.");
  }
}
