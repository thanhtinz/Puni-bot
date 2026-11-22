import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Save the AI chat master switch + model override + persona extra
 *  instructions (bot_config 'ai_enabled' / 'ai_model' /
 *  'ai_persona_extra'). The bot reads all three live (30s cache; the
 *  model and persona are consulted per reply). The API key itself stays
 *  in the bot process env — never on the web. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const enabled = form.get("ai_enabled") != null;
  const model = String(form.get("ai_model") ?? "").trim().slice(0, 80);
  const personaExtra = String(form.get("ai_persona_extra") ?? "").trim().slice(0, 1000);
  await setBotConfig("ai_enabled", enabled);
  await setBotConfig("ai_model", model);
  await setBotConfig("ai_persona_extra", personaExtra);
  return NextResponse.redirect(new URL("/admin/ai?saved=1", req.url), 303);
}
