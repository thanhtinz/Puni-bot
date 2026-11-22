import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Save the global bot on/off switch + maintenance message
 *  (bot_config 'bot_enabled' / 'maintenance_message'). The bot consults
 *  them (30s cache) on every command invocation. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const enabled = form.get("bot_enabled") != null;
  const message = String(form.get("maintenance_message") ?? "").trim().slice(0, 200);
  await setBotConfig("bot_enabled", enabled);
  await setBotConfig(
    "maintenance_message",
    message === "" ? "Puni đang bảo trì một chút, bạn quay lại sau nhé!" : message,
  );
  return NextResponse.redirect(new URL("/admin/ops?saved=1", req.url), 303);
}
