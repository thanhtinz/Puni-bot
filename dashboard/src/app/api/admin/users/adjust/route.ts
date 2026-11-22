import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { adminAdjustBalance } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Owner manual balance adjustment. The amount and mode are validated
 *  explicitly — an unknown/empty mode is an error, never a default
 *  (money-movement law: nothing silently falls into the "add" branch). */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const userId = String(form.get("user_id") ?? "").trim();
  const mode = String(form.get("mode") ?? "");
  const amount = Number.parseInt(String(form.get("amount") ?? ""), 10);
  const note = String(form.get("note") ?? "").trim();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/users?u=${encodeURIComponent(userId)}&${qs}`, req.url), 303);

  if (!/^\d{5,25}$/.test(userId)) return back("err=" + encodeURIComponent("Discord ID không hợp lệ."));
  if (mode !== "add" && mode !== "sub") return back("err=" + encodeURIComponent("Thao tác không hợp lệ."));
  if (!Number.isFinite(amount) || amount < 1 || amount > 100_000_000) {
    return back("err=" + encodeURIComponent("Số tiền phải từ 1 đến 100.000.000."));
  }
  const delta = mode === "add" ? amount : -amount;
  const result = await adminAdjustBalance(userId, delta, note || (mode === "add" ? "Chủ bot cộng tiền" : "Chủ bot trừ tiền"));
  if ("error" in result) return back("err=" + encodeURIComponent(result.error));
  return back("saved=1");
}
