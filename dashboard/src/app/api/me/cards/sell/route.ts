import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { sellCardWeb } from "@/lib/player";

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const code = String(form.get("code") ?? "").toUpperCase();
  const out = await sellCardWeb(session.userId, code);
  const url = new URL("/me/cards", req.url);
  if (out.ok) url.searchParams.set("msg", `Đã bán thẻ ${code} → +${(out.coins ?? 0).toLocaleString("en-US", { maximumFractionDigits: 4 })} Coins.`);
  else url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
