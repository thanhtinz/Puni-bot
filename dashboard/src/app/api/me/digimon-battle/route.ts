import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { digimonBattleWeb, digimonDeckPreview } from "@/lib/digimon";

/**
 * Digimon arena (spec 6.39i). The action field must match "fight"
 * exactly — anything else is an error, never a default branch
 * (money-safety rule). Returns the full event stream.
 */
export async function GET() {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const preview = await digimonDeckPreview(session.userId);
  return NextResponse.json(preview);
}

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const body = (await req.json().catch(() => ({}))) as { action?: string };
  if (body.action !== "fight") {
    return NextResponse.json({ error: "Thao tác không hợp lệ." }, { status: 400 });
  }
  const out = await digimonBattleWeb(session.userId);
  if (!out.ok) return NextResponse.json({ error: out.error }, { status: 400 });
  return NextResponse.json(out);
}
