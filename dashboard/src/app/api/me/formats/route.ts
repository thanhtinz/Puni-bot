import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import {
  dailyChallengeWeb,
  draftPickWeb,
  fightNextWeb,
  rememberFormatEvent,
  startRunWeb,
  type FormatKind,
} from "@/lib/formats";

/**
 * Battle-format actions (spec 6.38). The action field must match one
 * of the known verbs exactly — anything else is an error, never a
 * default branch (money-safety rule). Every outcome redirects back
 * to /me/battle; fight results ride the in-memory event store.
 */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const back = (params: Record<string, string>) => {
    const url = new URL("/me/battle", req.url);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    url.hash = "formats";
    return NextResponse.redirect(url);
  };
  const fail = (message: string) => back({ err: message });

  if (action === "challenge") {
    const out = await dailyChallengeWeb(session.userId);
    if (!out.ok) return fail(out.error);
    rememberFormatEvent(session.userId, {
      kind: "challenge",
      win: out.win,
      rounds: out.rounds,
      log: out.log,
      coins: out.coins,
      shards: out.rewardClaimed ? 5 : 0,
      rewardClaimed: out.rewardClaimed,
      enemyNames: out.enemy.map((c) => c.name),
    });
    return back({ fmt: "challenge" });
  }

  const format = String(form.get("format") ?? "");
  if (format !== "draft" && format !== "sealed") {
    return fail("Hình thức không hợp lệ.");
  }
  const kind: FormatKind = format;

  if (action === "start") {
    const out = await startRunWeb(session.userId, kind);
    if (!out.ok) return fail(out.error);
    return back({ fmt: format });
  }
  if (action === "pick") {
    if (kind !== "draft") return fail("Hành động không hợp lệ.");
    const pick = Number.parseInt(String(form.get("pick") ?? ""), 10);
    const out = await draftPickWeb(session.userId, pick);
    if (!out.ok) return fail(out.error);
    return back({ fmt: format });
  }
  if (action === "fight") {
    const out = await fightNextWeb(session.userId, kind);
    if (!out.ok) return fail(out.error);
    rememberFormatEvent(session.userId, {
      kind: "fight",
      format: kind,
      win: out.win,
      rounds: out.rounds,
      log: out.log,
      coins: out.coins,
      shards: out.shards,
      runDone: out.runDone,
      wins: out.wins,
      losses: out.losses,
      enemyNames: out.enemy.map((c) => c.name),
    });
    return back({ fmt: format });
  }
  return fail("Hành động không hợp lệ.");
}
