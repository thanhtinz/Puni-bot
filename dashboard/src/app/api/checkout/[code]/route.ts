import { NextResponse } from "next/server";
import { getMembershipOrder } from "@/lib/db";

export const dynamic = "force-dynamic";

/** Order status polling for the public checkout panel. Only the
 *  status fields are exposed — the order code itself is the key. */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ code: string }> },
) {
  const { code } = await params;
  const order = await getMembershipOrder(code.toUpperCase());
  if (!order) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  const status = order.expired ? "expired" : order.status;
  return NextResponse.json({
    code: order.code,
    tierName: order.tier_name,
    amount: Number.parseInt(order.amount, 10),
    status,
    paidAt: order.paid_at,
  });
}
