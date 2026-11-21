import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/discord";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const code = url.searchParams.get("code") || "";
  const state = url.searchParams.get("state") || "";
  const expectedState = req.cookies.get("puni_oauth_state")?.value;
  const home = new URL("/", url);
  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(new URL("/?login=invalid", url));
  }
  try {
    const { user, guilds } = await exchangeCode(code);
    const token = createSessionToken({
      userId: user.id,
      username: user.username,
      avatar: user.avatar,
      guilds,
    });
    const res = NextResponse.redirect(new URL("/dashboard", url));
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 7 * 24 * 3600,
      secure: process.env.NODE_ENV === "production",
    });
    res.cookies.delete("puni_oauth_state");
    return res;
  } catch {
    return NextResponse.redirect(new URL("/?login=failed", url));
  }
}
