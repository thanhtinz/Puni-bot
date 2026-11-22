import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { ITEM_CATEGORIES, deleteItem, setItemEnabled, upsertItem } from "@/lib/db";

export const dynamic = "force-dynamic";

const SLUG = /^[a-z0-9][a-z0-9-]{1,40}$/;

function money(form: FormData, name: string): number {
  const n = Number.parseInt(String(form.get(name) ?? ""), 10);
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.min(n, 1_000_000_000);
}

/** Item CRUD (Admin → Item). The action field must match exactly. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const id = String(form.get("id") ?? "").trim().toLowerCase();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/items?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));

  if (action === "delete") {
    if (!SLUG.test(id)) return fail("Mã item không hợp lệ.");
    await deleteItem(id);
    return back("saved=1");
  }
  if (action === "toggle") {
    if (!SLUG.test(id)) return fail("Mã item không hợp lệ.");
    await setItemEnabled(id, form.get("enabled") != null);
    return back("saved=1");
  }
  if (action !== "save") return fail("Thao tác không hợp lệ.");
  if (!SLUG.test(id)) return fail("Mã item phải là chữ thường/số/dấu gạch ngang, 2–41 ký tự.");
  const name = String(form.get("name") ?? "").trim().slice(0, 80);
  if (!name) return fail("Thiếu tên item.");
  const category = String(form.get("category") ?? "other");
  await upsertItem({
    id,
    name,
    category: ITEM_CATEGORIES.some((c) => c.id === category) ? category : "other",
    priceCoins: money(form, "price_coins"),
    priceGems: money(form, "price_gems"),
    sellPrice: money(form, "sell_price"),
    description: String(form.get("description") ?? "").trim().slice(0, 500),
    iconUrl: String(form.get("icon_url") ?? "").trim().slice(0, 500),
    enabled: form.get("enabled") != null,
  });
  return back("saved=1");
}
