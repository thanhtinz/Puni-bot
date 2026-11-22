import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { setBotConfig } from "@/lib/db";
import { normalizeVoteConfig } from "@/lib/vote";

export const dynamic = "force-dynamic";

/** Save the vote config (bot_config 'vote_config'; read live by the
 *  webhook and the /vote command). */
export async function POST(req: Request) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  const form = await req.formData();
  const cfg = normalizeVoteConfig({
    enabled: form.get("enabled") != null,
    rewardPerVote: Number.parseInt(String(form.get("reward") ?? ""), 10),
    weekendMultiplier: Number.parseInt(String(form.get("weekend_multiplier") ?? ""), 10),
    memberMultiplier: Number.parseInt(String(form.get("member_multiplier") ?? ""), 10),
    voteUrl: String(form.get("vote_url") ?? "").trim(),
  });
  await setBotConfig("vote_config", cfg);
  return NextResponse.redirect(new URL("/admin/vote?saved=1", req.url), 303);
}
