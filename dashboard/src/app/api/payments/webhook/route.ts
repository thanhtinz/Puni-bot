import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { confirmMembershipOrder, getMembershipOrder } from "@/lib/db";

export const dynamic = "force-dynamic";

function secretOk(given: string | null): boolean {
  const expected = process.env.PAYMENT_WEBHOOK_SECRET ?? "";
  if (!expected || !given) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Payment confirmation webhook (spec 6.19) for external bank-watch
 * systems (SePay-style / BankHub): POST { code, amount } with the
 * shared secret in the `x-webhook-secret` header. The order only
 * confirms when the amount matches exactly; repeats are idempotent.
 */
export async function POST(req: Request) {
  if (!secretOk(req.headers.get("x-webhook-secret"))) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  let body: { code?: unknown; amount?: unknown };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  const code = String(body.code ?? "").toUpperCase().trim();
  const amount = Number.parseInt(String(body.amount ?? ""), 10);
  if (!code || !Number.isFinite(amount)) {
    return NextResponse.json({ error: "bad_request" }, { status: 400 });
  }
  const order = await getMembershipOrder(code);
  if (!order) return NextResponse.json({ error: "not_found" }, { status: 404 });
  if (Number.parseInt(order.amount, 10) !== amount) {
    return NextResponse.json({ error: "amount_mismatch" }, { status: 422 });
  }
  const res = await confirmMembershipOrder(code);
  return NextResponse.json({ ok: true, result: res.result });
}
