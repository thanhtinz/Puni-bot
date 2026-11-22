import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { editDeckWeb, setActiveDeckWeb } from "@/lib/player";
import { publishDeckWeb, unpublishDeckWeb } from "@/lib/deck-search";

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
  } else if (action === "publish") {
    out = await publishDeckWeb(
      session.userId, session.username ?? "", deckId, String(form.get("description") ?? ""));
    if (out.ok) {
      url.searchParams.set("msg", "Đã công khai bộ bài — người chơi khác tìm thấy ở mục Tìm Bộ Bài.");
      return NextResponse.redirect(url);
    }
  } else if (action === "unpublish") {
    out = await unpublishDeckWeb(session.userId, deckId);
    if (out.ok) {
      url.searchParams.set("msg", "Đã huỷ công khai bộ bài.");
      return NextResponse.redirect(url);
    }
  } else {
    url.searchParams.set("err", "Hành động không hợp lệ.");
    return NextResponse.redirect(url);
  }
  if (out.ok) url.searchParams.set("msg", "Đã cập nhật bộ bài.");
  else url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
