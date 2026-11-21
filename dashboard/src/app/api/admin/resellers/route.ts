import { NextRequest, NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { shopApi } from "@/lib/shop-api";

export const dynamic = "force-dynamic";

/** Create-reseller proxy: the browser never sees the Shop bot key;
 *  this route checks the full admin gate, then calls the Shop API. */
export async function POST(req: NextRequest) {
  const gate = await adminGate();
  if (!gate.ok) return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  const form = await req.formData();
  const discordId = String(form.get("discordId") || "").trim();
  const discountPercent = Number.parseInt(String(form.get("discountPercent") || ""), 10);
  const guildIds = String(form.get("guildIds") || "")
    .split("\n")
    .map((g) => g.trim())
    .filter(Boolean);
  if (!/^\d{5,25}$/.test(discordId) || !Number.isInteger(discountPercent)) {
    return NextResponse.json({ error: "Dữ liệu không hợp lệ." }, { status: 400 });
  }
  try {
    await shopApi("/resellers", {
      method: "POST",
      body: JSON.stringify({ discordId, discountPercent, guildIds }),
    });
    return NextResponse.redirect(new URL("/admin/resellers", req.nextUrl));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Tạo reseller thất bại." },
      { status: 400 },
    );
  }
}
