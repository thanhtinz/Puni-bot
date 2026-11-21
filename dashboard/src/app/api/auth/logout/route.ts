import { NextRequest, NextResponse } from "next/server";
import { ADMIN_COOKIE, SESSION_COOKIE } from "@/lib/session";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const res = NextResponse.redirect(new URL("/", req.nextUrl));
  res.cookies.delete(SESSION_COOKIE);
  res.cookies.delete(ADMIN_COOKIE);
  return res;
}
