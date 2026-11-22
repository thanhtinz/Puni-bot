import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { deleteShopListing, setShopListingEnabled, upsertShopListing } from "@/lib/db";

export const dynamic = "force-dynamic";

function optMoney(form: FormData, name: string): number | null {
  const raw = String(form.get(name) ?? "").trim();
  if (raw === "") return null;
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.min(n, 1_000_000_000);
}

/** In-game shop listing CRUD (Admin → Shop game). Action must match. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/game-shop?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));

  if (action === "delete") {
    const id = String(form.get("id") ?? "");
    if (!/^\d+$/.test(id)) return fail("Mã niêm yết không hợp lệ.");
    await deleteShopListing(id);
    return back("saved=1");
  }
  if (action === "toggle") {
    const id = String(form.get("id") ?? "");
    if (!/^\d+$/.test(id)) return fail("Mã niêm yết không hợp lệ.");
    await setShopListingEnabled(id, form.get("enabled") != null);
    return back("saved=1");
  }
  if (action !== "save") return fail("Thao tác không hợp lệ.");
  const itemId = String(form.get("item_id") ?? "").trim();
  if (!itemId) return fail("Chưa chọn item.");
  const stockRaw = String(form.get("stock") ?? "").trim();
  const stock = stockRaw === "" ? null : Number.parseInt(stockRaw, 10);
  if (stock !== null && (!Number.isFinite(stock) || stock < 0)) {
    return fail("Tồn kho phải là số ≥ 0 hoặc để trống (không giới hạn).");
  }
  const sort = Number.parseInt(String(form.get("sort") ?? "0"), 10);
  await upsertShopListing({
    itemId,
    priceCoins: optMoney(form, "price_coins"),
    priceGems: optMoney(form, "price_gems"),
    stock,
    sort: Number.isFinite(sort) ? Math.min(Math.max(sort, 0), 9999) : 0,
    enabled: form.get("enabled") != null,
  });
  return back("saved=1");
}
