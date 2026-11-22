import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Save the global economy config (bot_config 'economy'). Normalized
 *  server-side with the same clamps the bot applies on read. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const int = (v: FormDataEntryValue | null, fallback: number, max: number): number => {
    const n = Number.parseInt(String(v ?? ""), 10);
    if (!Number.isFinite(n)) return fallback;
    return Math.min(Math.max(n, 0), max);
  };
  const nameRaw = String(form.get("currencyName") ?? "").trim().slice(0, 24);
  const gemsRaw = String(form.get("gemsName") ?? "").trim().slice(0, 24);
  const cfg = {
    currencyName: nameRaw === "" ? "Coins" : nameRaw,
    gemsName: gemsRaw === "" ? "Gems" : gemsRaw,
    dailyBase: int(form.get("dailyBase"), 100, 1_000_000),
    dailyStreakBonus: int(form.get("dailyStreakBonus"), 10, 100_000),
    dailyStreakBonusCap: int(form.get("dailyStreakBonusCap"), 100, 1_000_000),
  };
  await setBotConfig("economy", cfg);
  return NextResponse.redirect(new URL("/admin/economy?saved=1", req.url), 303);
}
