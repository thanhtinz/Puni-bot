import { NextRequest, NextResponse } from "next/server";
import { exchangeCode } from "@/lib/discord";
import { SESSION_COOKIE, createSessionToken } from "@/lib/session";
import { db } from "@/lib/db";

/**
 * Post-login routing (spec 6.24, owner decision 2026-11-21): if the
 * user manages at least one server where Puni is present (a
 * guild_settings row exists), land on the server dashboard; everyone
 * else lands on the player area /me.
 */
async function landingFor(guilds: { id: string; permissions: string }[]): Promise<string> {
  const manageable = guilds.filter((g) => {
    try {
      const bits = BigInt(g.permissions);
      return (bits & 0x8n) !== 0n || (bits & 0x20n) !== 0n;
    } catch {
      return false;
    }
  });
  if (!manageable.length) return "/me";
  try {
    const res = await db().query<{ guild_id: string }>(
      `SELECT guild_id FROM guild_settings WHERE guild_id = ANY($1)`,
      [manageable.map((g) => g.id)],
    );
    return res.rows.length ? "/dashboard" : "/me";
  } catch {
    return "/dashboard";
  }
}

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
    const res = NextResponse.redirect(new URL(await landingFor(guilds), url));
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
