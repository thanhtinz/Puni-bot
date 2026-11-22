import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig } from "@/lib/db";
import { FISH_RARITIES, normalizeFishingConfig } from "@/lib/fishing";

export const dynamic = "force-dynamic";

/** Save the fishing config (bot_config 'fishing_config'). */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const weights: Record<string, number> = {};
  const priceMin: Record<string, number> = {};
  const priceMax: Record<string, number> = {};
  for (const k of FISH_RARITIES) {
    weights[k] = Number.parseInt(String(form.get(`w_${k}`) ?? ""), 10);
    priceMin[k] = Number.parseInt(String(form.get(`min_${k}`) ?? ""), 10);
    priceMax[k] = Number.parseInt(String(form.get(`max_${k}`) ?? ""), 10);
  }
  const raw = {
    enabled: form.get("enabled") != null,
    cooldownSec: Number.parseInt(String(form.get("cooldown") ?? ""), 10),
    dailyCap: Number.parseInt(String(form.get("daily_cap") ?? ""), 10),
    weights,
    priceMin,
    priceMax,
  };
  await setBotConfig("fishing_config", normalizeFishingConfig(raw));
  return NextResponse.redirect(new URL("/admin/fishing?saved=1", req.url), 303);
}
