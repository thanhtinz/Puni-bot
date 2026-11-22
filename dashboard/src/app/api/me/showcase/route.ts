import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import {
  buyShowcase, buyShowcaseTheme, saveShowcase, setShowcasePin,
} from "@/lib/showcase";

/** Showcase actions (spec 6.30). The action field must match exactly —
 *  money actions never fall through to a default branch. */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const url = new URL("/me/showcase", req.url);
  let out;
  if (action === "buy") {
    out = await buyShowcase(session.userId);
  } else if (action === "buy-theme") {
    out = await buyShowcaseTheme(session.userId, String(form.get("theme") ?? ""));
  } else if (action === "save") {
    out = await saveShowcase(session.userId, {
      layout: String(form.get("layout") ?? ""),
      theme: String(form.get("theme") ?? ""),
      effect: String(form.get("effect") ?? ""),
      isPublic: form.get("isPublic") === "on",
    });
  } else if (action === "pin" || action === "unpin") {
    out = await setShowcasePin(session.userId, String(form.get("code") ?? ""), action === "pin");
  } else {
    url.searchParams.set("err", "Hành động không hợp lệ.");
    return NextResponse.redirect(url);
  }
  if (out.ok) url.searchParams.set("msg", "Đã lưu trang trưng bày.");
  else url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
