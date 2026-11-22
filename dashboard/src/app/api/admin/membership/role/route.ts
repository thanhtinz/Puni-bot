import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Save the member role id for the main guild (bot_config
 *  'membership_role_id'; empty = role perk off). The bot syncs the
 *  role onto active members and removes it when they expire. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const roleId = String(form.get("role_id") ?? "").trim();
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/admin/membership?${qs}`, req.url), 303);
  if (roleId && !/^\d{5,25}$/.test(roleId)) {
    return back("err=" + encodeURIComponent("Role ID phải là dãy số Discord (5–25 chữ số), hoặc để trống để tắt."));
  }
  await setBotConfig("membership_role_id", roleId);
  return back("saved=1");
}
