import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { buyPackWeb, buyFeaturedCardWeb, buySingleCardWeb, SHOP_PACK_PRICES } from "@/lib/shop";

/**
 * Web shop actions (spec 6.24): buy a pack or one of today's featured
 * cards. The `kind` field must match exactly — anything else is an
 * error, never a default action (money-action rule). Prices are
 * always recomputed server-side in lib/shop.
 */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const url = new URL("/me/shop", req.url);

  if (kind === "pack-standard" || kind === "pack-premium") {
    const premium = kind === "pack-premium";
    const out = await buyPackWeb(session.userId, premium);
    if (!out.ok) {
      url.searchParams.set("err", out.error);
    } else {
      const price = premium ? SHOP_PACK_PRICES.premium : SHOP_PACK_PRICES.standard;
      url.searchParams.set(
        "msg",
        `Đã mua 1 ${premium ? "Gói Cao Cấp" : "Gói Thường"} với ${price.toLocaleString("en-US", { maximumFractionDigits: 4 })} Coins. Mở gói ở trang Mở Thẻ.`,
      );
    }
    return NextResponse.redirect(url);
  }
  if (kind === "card") {
    const species = String(form.get("species") ?? "").slice(0, 60);
    const out = await buyFeaturedCardWeb(session.userId, species);
    if (!out.ok) {
      url.searchParams.set("err", out.error);
    } else {
      url.searchParams.set(
        "msg",
        `Đã mua thẻ với ${out.price.toLocaleString("en-US", { maximumFractionDigits: 4 })} Coins. Mã thẻ của bạn: ${out.code}.`,
      );
    }
    return NextResponse.redirect(url);
  }
  if (kind === "card-single") {
    const species = String(form.get("species") ?? "").slice(0, 60);
    const back = String(form.get("back") ?? "");
    const target =
      back.startsWith("/me/shop/") && !back.includes("..")
        ? new URL(back, req.url)
        : url;
    const out = await buySingleCardWeb(session.userId, species);
    if (!out.ok) {
      target.searchParams.set("err", out.error);
    } else {
      target.searchParams.set(
        "msg",
        `Đã mua thẻ với ${out.price.toLocaleString("en-US", { maximumFractionDigits: 4 })} Coins. Mã thẻ của bạn: ${out.code}.`,
      );
      if (target.pathname === "/me/shop") target.searchParams.set("bought", species);
    }
    return NextResponse.redirect(target);
  }
  url.searchParams.set("err", "Thao tác không hợp lệ.");
  return NextResponse.redirect(url);
}
