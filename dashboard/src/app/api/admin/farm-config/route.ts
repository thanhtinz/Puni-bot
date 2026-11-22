import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig } from "@/lib/db";
import { normalizeFarmConfig } from "@/lib/farm";

export const dynamic = "force-dynamic";

/** Save the farm config (bot_config 'farm_config'; the bot reads it live). */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const cfg = normalizeFarmConfig({
    enabled: form.get("enabled") != null,
    defaultPlots: Number.parseInt(String(form.get("default_plots") ?? ""), 10),
    memberExtraPlots: Number.parseInt(String(form.get("member_extra_plots") ?? ""), 10),
  });
  await setBotConfig("farm_config", cfg);
  return NextResponse.redirect(new URL("/admin/farm?saved=1", req.url), 303);
}
