import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setSiteSetting } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Save public-website settings (admin website page). Owner-only via
 *  adminGate; values are normalized server-side — the Support link must
 *  be an https URL or empty (empty hides the menu item). */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const raw = String(form.get("support_url") ?? "").trim();
  let supportUrl = "";
  if (raw !== "") {
    let parsed: URL | null = null;
    try {
      parsed = new URL(raw);
    } catch {
      parsed = null;
    }
    if (!parsed || parsed.protocol !== "https:") {
      return NextResponse.redirect(new URL("/admin/website?saved=invalid", req.url), 303);
    }
    supportUrl = parsed.toString();
  }
  await setSiteSetting("support_url", supportUrl);
  return NextResponse.redirect(new URL("/admin/website?saved=1", req.url), 303);
}
