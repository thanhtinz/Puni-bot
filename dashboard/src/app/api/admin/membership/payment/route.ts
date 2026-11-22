import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setSiteSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Save the receiving bank account for VietQR checkout (site settings
 *  pay_*). All three fields together, or all empty to disable online
 *  sales. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const bin = String(form.get("pay_bank_bin") ?? "").trim();
  const acc = String(form.get("pay_account_no") ?? "").trim();
  const name = String(form.get("pay_account_name") ?? "").trim().slice(0, 80);
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/membership?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));

  if (!bin && !acc && !name) {
    await setSiteSetting("pay_bank_bin", "");
    await setSiteSetting("pay_account_no", "");
    await setSiteSetting("pay_account_name", "");
    return back("saved=1");
  }
  if (!/^\d{6}$/.test(bin)) return fail("Mã ngân hàng (BIN) phải gồm đúng 6 chữ số.");
  if (!/^\d{6,24}$/.test(acc)) return fail("Số tài khoản phải gồm 6–24 chữ số.");
  if (!name) return fail("Thiếu tên chủ tài khoản.");
  await setSiteSetting("pay_bank_bin", bin);
  await setSiteSetting("pay_account_no", acc);
  await setSiteSetting("pay_account_name", name);
  return back("saved=1");
}
