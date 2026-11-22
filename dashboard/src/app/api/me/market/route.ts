import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { buyListingWeb, cancelListingWeb, createListingWeb } from "@/lib/player";

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const url = new URL("/me/cho", req.url);
  let out;
  if (action === "buy") {
    out = await buyListingWeb(session.userId, Number.parseInt(String(form.get("listingId") ?? ""), 10));
  } else if (action === "cancel") {
    out = await cancelListingWeb(session.userId, Number.parseInt(String(form.get("listingId") ?? ""), 10));
  } else if (action === "sell") {
    out = await createListingWeb(
      session.userId,
      String(form.get("code") ?? "").toUpperCase(),
      Number.parseInt(String(form.get("price") ?? ""), 10),
    );
  } else {
    url.searchParams.set("err", "Hành động không hợp lệ.");
    return NextResponse.redirect(url);
  }
  if (out.ok) url.searchParams.set("msg", "Thao tác chợ thành công.");
  else url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
