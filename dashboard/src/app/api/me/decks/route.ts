import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { editDeckWeb, setActiveDeckWeb } from "@/lib/player";

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const deckId = Number.parseInt(String(form.get("deckId") ?? ""), 10);
  const url = new URL("/me/decks", req.url);
  if (!Number.isInteger(deckId)) {
    url.searchParams.set("err", "Thiếu mã bộ bài.");
    return NextResponse.redirect(url);
  }
  let out;
  if (action === "set-active") out = await setActiveDeckWeb(session.userId, deckId);
  else if (action === "add" || action === "remove") {
    out = await editDeckWeb(session.userId, deckId, action, String(form.get("code") ?? "").toUpperCase());
  } else {
    url.searchParams.set("err", "Hành động không hợp lệ.");
    return NextResponse.redirect(url);
  }
  if (out.ok) url.searchParams.set("msg", "Đã cập nhật bộ bài.");
  else url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
