import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { saveProfile } from "@/lib/player";

export async function POST(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.redirect(new URL("/api/auth/login", req.url));
  const form = await req.formData();
  const birthdayRaw = String(form.get("birthday") ?? "").trim();
  const birthday = /^\d{4}-\d{2}-\d{2}$/.test(birthdayRaw) ? birthdayRaw : null;
  await saveProfile(session.userId, {
    gender: String(form.get("gender") ?? ""),
    birthday,
    hobby: String(form.get("hobby") ?? ""),
    statusText: String(form.get("statusText") ?? ""),
  });
  return NextResponse.redirect(new URL("/me?saved=1", req.url));
}
