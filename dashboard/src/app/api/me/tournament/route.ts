import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { isOwner } from "@/lib/session";
import {
  cancelTournament, createTournament, getTournamentConfig,
  joinTournament, playMatch,
} from "@/lib/tournament";

/** Tournament actions (spec 6.32). The action field must match
 *  exactly — money actions never fall through to a default branch.
 *  `create` and `cancel` are owner-only. */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const url = new URL("/me/tournament", req.url);
  const num = (k: string, fb: number) => {
    const n = Number.parseFloat(String(form.get(k) ?? ""));
    return Number.isFinite(n) ? n : fb;
  };
  let out;
  if (action === "create") {
    if (!isOwner(session)) {
      url.searchParams.set("err", "Chỉ chủ bot mới tạo được giải đấu.");
      return NextResponse.redirect(url);
    }
    const cfg = await getTournamentConfig();
    out = await createTournament(session.userId, {
      name: String(form.get("name") ?? ""),
      size: Math.round(num("size", cfg.size)),
      entryFee: num("entryFee", cfg.entryFee),
      rakePercent: num("rakePercent", cfg.rakePercent),
      prizeFirst: num("prizeFirst", cfg.prizeFirst),
      prizeSecond: num("prizeSecond", cfg.prizeSecond),
      prizeSemis: num("prizeSemis", cfg.prizeSemis),
    });
  } else if (action === "join") {
    out = await joinTournament(
      session.userId,
      Number.parseInt(String(form.get("tournamentId") ?? ""), 10),
    );
  } else if (action === "play") {
    out = await playMatch(
      session.userId,
      Number.parseInt(String(form.get("matchId") ?? ""), 10),
    );
  } else if (action === "cancel") {
    if (!isOwner(session)) {
      url.searchParams.set("err", "Chỉ chủ bot mới huỷ được giải đấu.");
      return NextResponse.redirect(url);
    }
    out = await cancelTournament(
      Number.parseInt(String(form.get("tournamentId") ?? ""), 10),
    );
  } else {
    url.searchParams.set("err", "Hành động không hợp lệ.");
    return NextResponse.redirect(url);
  }
  if (out.ok) url.searchParams.set("msg", "Thao tác giải đấu thành công.");
  else url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
