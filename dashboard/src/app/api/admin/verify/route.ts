import { createHash, timingSafeEqual } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { ADMIN_COOKIE, createAdminToken, isOwner } from "@/lib/session";
import { verifyTotp } from "@/lib/totp";

export const dynamic = "force-dynamic";

function sha256Hex(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}

/**
 * Second-factor verification for the admin panel. Every factor the
 * server has configured must pass: ADMIN_PANEL_PASSWORD_SHA256
 * (hex sha256 of the admin password) and/or OWNER_TOTP_SECRET
 * (base32). Success issues the signed 12h admin cookie.
 */
export async function POST(req: NextRequest) {
  const session = await currentSession();
  if (!session || !isOwner(session)) {
    return NextResponse.json({ error: "Không có quyền." }, { status: 403 });
  }
  const form = await req.formData();
  const passwordHash = process.env.ADMIN_PANEL_PASSWORD_SHA256 || "";
  const totpSecret = process.env.OWNER_TOTP_SECRET || "";
  let ok = true;
  if (passwordHash) {
    const given = sha256Hex(String(form.get("password") || ""));
    if (!safeEqual(given, passwordHash.toLowerCase())) ok = false;
  }
  if (ok && totpSecret) {
    if (!verifyTotp(totpSecret, String(form.get("totp") || ""))) ok = false;
  }
  if (!ok) {
    return NextResponse.redirect(new URL("/admin?verify=failed", req.nextUrl));
  }
  const res = NextResponse.redirect(new URL("/admin", req.nextUrl));
  res.cookies.set(ADMIN_COOKIE, createAdminToken(session.userId), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 12 * 3600,
    secure: process.env.NODE_ENV === "production",
  });
  return res;
}
