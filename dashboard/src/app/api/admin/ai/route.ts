import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Save the AI chat master switch (bot_config 'ai_enabled'). The bot
 *  consults it (30s cache) before answering any @mention. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const enabled = form.get("ai_enabled") != null;
  await setBotConfig("ai_enabled", enabled);
  return NextResponse.redirect(new URL("/admin/ai?saved=1", req.url), 303);
}
