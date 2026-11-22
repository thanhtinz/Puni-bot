import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import {
  buyNowAuction, cancelAuction, createAuction, placeBid,
} from "@/lib/auction";

/** Auction actions (spec 6.31). The action field must match exactly —
 *  money actions never fall through to a default branch. */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const action = String(form.get("action") ?? "");
  const url = new URL("/me/auction", req.url);
  let out;
  if (action === "create") {
    out = await createAuction(
      session.userId,
      String(form.get("code") ?? ""),
      String(form.get("startPrice") ?? ""),
      Number.parseInt(String(form.get("hours") ?? ""), 10),
      String(form.get("buyNow") ?? ""),
    );
  } else if (action === "bid") {
    out = await placeBid(
      session.userId,
      Number.parseInt(String(form.get("auctionId") ?? ""), 10),
      String(form.get("amount") ?? ""),
    );
  } else if (action === "buy-now") {
    out = await buyNowAuction(session.userId, Number.parseInt(String(form.get("auctionId") ?? ""), 10));
  } else if (action === "cancel") {
    out = await cancelAuction(session.userId, Number.parseInt(String(form.get("auctionId") ?? ""), 10));
  } else {
    url.searchParams.set("err", "Hành động không hợp lệ.");
    return NextResponse.redirect(url);
  }
  if (out.ok) url.searchParams.set("msg", "Thao tác đấu giá thành công.");
  else url.searchParams.set("err", out.error);
  return NextResponse.redirect(url);
}
