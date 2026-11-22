import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { pullWeb, openPackWeb, claimFreePackWeb } from "@/lib/gacha";

/**
 * Web gacha actions (spec 6.24): pull / pack / free claim, form POST
 * with the player area's redirect + msg/err convention. The `kind`
 * field must match exactly — anything else is an error, never a
 * default action (money-action rule).
 */
export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const kind = String(form.get("kind") ?? "");
  const url = new URL("/me/gacha", req.url);

  if (kind === "pull") {
    const banner = String(form.get("banner") ?? "standard").slice(0, 40);
    const count = String(form.get("count") ?? "1") === "10" ? 10 : 1;
    const out = await pullWeb(session.userId, banner, count as 1 | 10);
    if (!out.ok) {
      url.searchParams.set("err", out.error);
    } else {
      url.searchParams.set("msg", `Đã mở ${out.results.length} thẻ, tốn ${out.cost.toLocaleString("en-US", { maximumFractionDigits: 4 })} Coins.`);
      url.searchParams.set("reveal", out.results.map((r) => r.code).join(","));
    }
    return NextResponse.redirect(url);
  }
  if (kind === "pack") {
    const premium = String(form.get("pack") ?? "") === "premium";
    const out = await openPackWeb(session.userId, premium);
    if (!out.ok) {
      url.searchParams.set("err", out.error);
    } else {
      url.searchParams.set("msg", `Đã mở gói ${premium ? "Cao Cấp" : "Thường"}: ${out.results.length} thẻ mới.`);
      url.searchParams.set("reveal", out.results.map((r) => r.code).join(","));
    }
    return NextResponse.redirect(url);
  }
  if (kind === "free") {
    const out = await claimFreePackWeb(session.userId);
    if (!out.ok) url.searchParams.set("err", out.error);
    else url.searchParams.set("msg", `Đã nhận ${out.packs} Gói Thường miễn phí hôm nay. Mở ngay ở mục Gói thẻ bên dưới.`);
    return NextResponse.redirect(url);
  }
  url.searchParams.set("err", "Thao tác không hợp lệ.");
  return NextResponse.redirect(url);
}
