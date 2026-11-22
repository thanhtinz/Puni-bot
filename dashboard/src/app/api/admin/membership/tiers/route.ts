import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig, setSiteSetting } from "@/lib/db";
import { normalizeMembershipTiers, type MembershipTier } from "@/lib/membership";

export const dynamic = "force-dynamic";

/** Save the membership tier definitions (bot_config 'membership_tiers')
 *  + the public join link (site_settings 'membership_url'). The bot
 *  re-normalizes on read, and so does this route before saving — the
 *  stored shape is always valid. */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const form = await req.formData();
  const raw: Partial<MembershipTier>[] = [];
  for (let i = 0; i < 4; i++) {
    const p = `t${i}_`;
    const name = String(form.get(`${p}name`) ?? "").trim();
    if (!name) continue;
    raw.push({
      id: String(form.get(`${p}id`) ?? ""),
      name,
      priceLabel: String(form.get(`${p}price`) ?? ""),
      priceAmount: Number.parseInt(String(form.get(`${p}amount`) ?? "0"), 10),
      dailyBonusPercent: Number.parseInt(String(form.get(`${p}bonus`) ?? "0"), 10),
      extraTeams: Number.parseInt(String(form.get(`${p}teams`) ?? "0"), 10),
      extraLootboxPerDay: Number.parseInt(String(form.get(`${p}loot`) ?? "0"), 10),
      exclusivePets: form.get(`${p}pets`) != null,
      perks: String(form.get(`${p}perks`) ?? "")
        .split("\n")
        .map((x) => x.trim())
        .filter(Boolean),
    });
  }
  await setBotConfig("membership_tiers", normalizeMembershipTiers(raw));
  const url = String(form.get("membership_url") ?? "").trim();
  if (url === "" || url.startsWith("https://")) {
    await setSiteSetting("membership_url", url);
  } else {
    return NextResponse.redirect(new URL("/admin/membership?err=" + encodeURIComponent("Link đăng ký phải bắt đầu bằng https://"), req.url), 303);
  }
  return NextResponse.redirect(new URL("/admin/membership?saved=1", req.url), 303);
}
