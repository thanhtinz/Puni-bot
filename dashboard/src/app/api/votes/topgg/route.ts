import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { acceptVote, getBotConfig, getUserMembership } from "@/lib/db";
import { normalizeMembershipTiers } from "@/lib/membership";
import { computeVoteReward, normalizeVoteConfig } from "@/lib/vote";

export const dynamic = "force-dynamic";

function secretOk(given: string | null): boolean {
  const expected = process.env.TOPGG_WEBHOOK_SECRET ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

interface TopggPayload {
  bot?: string;
  user?: string;
  type?: string;
  isWeekend?: boolean;
}

/**
 * top.gg vote webhook (spec 6.22). top.gg POSTs { bot, user, type,
 * isWeekend } with the webhook password in the Authorization header.
 * Accepted votes credit the global economy exactly once (12h dedupe
 * inside acceptVote). Test pings are acknowledged without crediting.
 */
export async function POST(req: Request) {
  if (!secretOk(req.headers.get("authorization"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: TopggPayload;
  try {
    body = (await req.json()) as TopggPayload;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (body.type === "test") {
    return NextResponse.json({ ok: true, test: true });
  }
  if (body.type !== "upvote") {
    return NextResponse.json({ error: "unsupported_type" }, { status: 400 });
  }
  const userId = String(body.user ?? "");
  if (!/^\d{5,25}$/.test(userId)) {
    return NextResponse.json({ error: "bad_user" }, { status: 400 });
  }
  const cfg = normalizeVoteConfig(await getBotConfig("vote_config").catch(() => null));
  if (!cfg.enabled) {
    return NextResponse.json({ ok: true, skipped: "disabled" });
  }
  // Member multiplier applies from the second tier up (spec 6.19).
  let qualified = false;
  const membership = await getUserMembership(userId).catch(() => null);
  if (membership?.active) {
    const tiers = normalizeMembershipTiers(await getBotConfig("membership_tiers").catch(() => null));
    qualified = tiers.findIndex((t) => t.id === membership.tier_id) >= 1;
  }
  const reward = computeVoteReward(cfg, {
    isWeekend: body.isWeekend === true,
    isQualifiedMember: qualified,
  });
  const result = await acceptVote({ userId, reward, isWeekend: body.isWeekend === true });
  return NextResponse.json({ ok: true, result, reward });
}
