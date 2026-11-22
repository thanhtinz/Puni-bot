import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { cardBattleWeb, rememberBattle } from "@/lib/battle";

/**
 * Web card battle action (spec 6.24): one fight against a generated
 * enemy team with the active deck's first 5 cards. The `kind` field
 * must match exactly — anything else is an error, never a default
 * action (money-action rule).
 */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const url = new URL("/me/battle", req.url);

  if (kind === "fight") {
    const out = await cardBattleWeb(session.userId);
    if (!out.ok) {
      url.searchParams.set("err", out.error);
    } else {
      rememberBattle(session.userId, out);
      url.searchParams.set("done", "1");
    }
    return NextResponse.redirect(url);
  }
  url.searchParams.set("err", "Thao tác không hợp lệ.");
  return NextResponse.redirect(url);
}
