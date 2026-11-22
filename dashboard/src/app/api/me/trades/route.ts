import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { answerTradeWeb } from "@/lib/player";

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const tradeId = Number.parseInt(String(form.get("tradeId") ?? ""), 10);
  const url = new URL("/me/trades", req.url);
  if (action !== "accept" && action !== "reject") {
    url.searchParams.set("err", "Hành động không hợp lệ.");
    return NextResponse.redirect(url);
  }
  const out = await answerTradeWeb(session.userId, tradeId, action === "accept");
  if (out.ok) url.searchParams.set("msg", action === "accept" ? "Đã nhận đề nghị." : "Đã từ chối đề nghị.");
  else url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
