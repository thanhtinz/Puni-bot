import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/discord";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";

/**
 * Post-login routing (spec 6.28 pivot, owner 2026-11-21 23:27):
 * Puni is a pure game bot — login ALWAYS lands in the player area
 * /me. There is no server dashboard anymore.
 */
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
    const res = NextResponse.redirect(new URL("/me", url));
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
