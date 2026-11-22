import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { getBotConfig, grantMembership, revokeMembership } from "@/lib/db";
import { normalizeMembershipTiers } from "@/lib/membership";

export const dynamic = "force-dynamic";

/** Grant/extend or revoke a membership. The action field must match
 *  exactly — anything else is an error, never a default branch. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const userId = String(form.get("user_id") ?? "").trim();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/membership?${qs}`, req.url), 303);
  const fail = (msg: string) => back("err=" + encodeURIComponent(msg));

  if (!/^\d{5,25}$/.test(userId)) return fail("Discord ID không hợp lệ.");

  if (action === "revoke") {
    await revokeMembership(userId);
    return back("granted=1");
  }
  if (action !== "grant") return fail("Thao tác không hợp lệ.");

  const tiers = normalizeMembershipTiers(await getBotConfig("membership_tiers").catch(() => null));
  const tierId = String(form.get("tier_id") ?? "");
  if (!tiers.some((t) => t.id === tierId)) return fail("Gói không tồn tại.");
  const days = Number.parseInt(String(form.get("days") ?? ""), 10);
  if (!Number.isFinite(days) || days < 1 || days > 3650) return fail("Số ngày phải từ 1 đến 3650.");
  const source = String(form.get("source") ?? "manual").trim() || "manual";
  const note = String(form.get("note") ?? "").trim();
  await grantMembership({ userId, tierId, days, source, note });
  return back("granted=1");
}
