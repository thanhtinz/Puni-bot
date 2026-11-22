import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { cancelMembershipOrder, confirmMembershipOrder } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Confirm (payment received → membership granted in the same
 *  transaction) or cancel a membership order. Action must match
 *  exactly — no default branch. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const code = String(form.get("code") ?? "").toUpperCase().trim();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/membership?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));
  if (!/^PUNI-[A-Z0-9]{6}$/.test(code)) return fail("Mã đơn không hợp lệ.");

  if (action === "confirm") {
    const res = await confirmMembershipOrder(code);
    if (res.result === "not_found") return fail("Không tìm thấy đơn.");
    if (res.result === "cancelled") return fail("Đơn đã bị huỷ, không xác nhận được.");
    return back("granted=1");
  }
  if (action === "cancel") {
    const ok = await cancelMembershipOrder(code);
    return ok ? back("saved=1") : fail("Đơn không còn ở trạng thái chờ.");
  }
  return fail("Thao tác không hợp lệ.");
}
