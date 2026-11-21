import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { authorizeUrl, discordClientId } from "@/lib/discord";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  if (!discordClientId()) {
    return NextResponse.json(
      { error: "Đăng nhập Discord chưa được cấu hình trên máy chủ này." },
      { status: 503 },
    );
  }
  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(authorizeUrl(state));
  res.cookies.set("puni_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
