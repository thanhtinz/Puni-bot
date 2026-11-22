import { NextResponse } from "next/server";
import { createMembershipOrder, getBotConfig } from "@/lib/db";
import { normalizeMembershipTiers } from "@/lib/membership";
import { getPaymentSettings, vietQrUrl } from "@/lib/payment";

export const dynamic = "force-dynamic";

/**
 * Public checkout (spec 6.19): pick a tier + type a Discord ID → an
 * order is created and a VietQR for the exact amount is returned. No
 * login: the Discord ID typed here is who receives the membership
 * once payment is confirmed.
 */
export async function POST(req: Request) {
  let body: { tierId?: unknown; userId?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  const userId = String(body.userId ?? "").trim();
  if (!/^\d{5,25}$/.test(userId)) {
    return NextResponse.json(
      { error: "Discord ID phải là dãy số (5–25 chữ số). Bật Developer Mode trong Discord, chuột phải vào avatar của bạn → Copy User ID." },
      { status: 400 },
    );
  }
  const pay = await getPaymentSettings();
  if (!pay) {
    return NextResponse.json(
      { error: "Hệ thống chưa mở bán trực tuyến. Vui lòng liên hệ Support để đăng ký." },
      { status: 503 },
    );
  }
  const tiers = normalizeMembershipTiers(await getBotConfig("membership_tiers").catch(() => null));
  const tier = tiers.find((t) => t.id === String(body.tierId ?? ""));
  if (!tier) {
    return NextResponse.json({ error: "Gói không tồn tại." }, { status: 400 });
  }
  if (tier.priceAmount <= 0) {
    return NextResponse.json(
      { error: "Gói này chưa mở bán trực tuyến. Vui lòng liên hệ Support." },
      { status: 400 },
    );
  }
  const order = await createMembershipOrder({
    userId,
    tierId: tier.id,
    tierName: tier.name,
    amount: tier.priceAmount,
    days: 30,
  });
  if (!order) {
    return NextResponse.json(
      { error: "Bạn đang có quá nhiều đơn chờ thanh toán. Hoàn tất hoặc chờ các đơn cũ hết hạn rồi thử lại." },
      { status: 429 },
    );
  }
  return NextResponse.json({
    code: order.code,
    tierName: tier.name,
    amount: tier.priceAmount,
    days: 30,
    qrUrl: vietQrUrl(pay, tier.priceAmount, order.code),
    bank: { bin: pay.bankBin, accountNo: pay.accountNo, accountName: pay.accountName },
  });
}
