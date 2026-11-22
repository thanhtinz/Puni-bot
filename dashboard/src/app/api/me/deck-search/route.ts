import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { adoptDeckWeb } from "@/lib/deck-search";

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const deckId = Number.parseInt(String(form.get("deckId") ?? ""), 10);
  if (action !== "adopt" || !Number.isInteger(deckId)) {
    const url = new URL("/me/deck-search", req.url);
    url.searchParams.set("err", "Hành động không hợp lệ.");
    return NextResponse.redirect(url);
  }
  const out = await adoptDeckWeb(session.userId, deckId);
  if (out.ok) {
    const url = new URL("/me/decks", req.url);
    url.searchParams.set("msg", "Đã tạo bộ bài mới từ bộ công khai — xem ở danh sách bộ bài của bạn.");
    return NextResponse.redirect(url);
  }
  const url = new URL("/me/deck-search", req.url);
  url.searchParams.set("deck", String(deckId));
  url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
