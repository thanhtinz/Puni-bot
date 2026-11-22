import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { canManageGuild } from "@/lib/session";
import { getGuildRow, saveGuildSection } from "@/lib/db";
import { normalizeBranding } from "@/lib/guild-config";

export const dynamic = "force-dynamic";

const ALLOWED = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);
const MAX_BYTES = 200 * 1024;

/**
 * White label avatar upload (spec 6.25): the guild manager uploads an
 * image; it is stored as a data URI in guild_settings.branding and
 * the bot applies it as its guild-member avatar. Same two-layer
 * check as every dashboard write: session + manage rights on THIS
 * guild, then type/size re-validated server-side.
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!canManageGuild(session, guildId)) {
    return NextResponse.json({ error: "Không có quyền quản lý server này." }, { status: 403 });
  }
  const back = (qs: string) =>
    NextResponse.redirect(new URL(`/dashboard/${guildId}/branding?${qs}`, req.nextUrl));
  const form = await req.formData().catch(() => null);
  const file = form?.get("avatar");
  if (!(file instanceof File) || file.size === 0) return back("err=missing");
  if (!ALLOWED.has(file.type)) return back("err=type");
  if (file.size > MAX_BYTES) return back("err=size");
  const buf = Buffer.from(await file.arrayBuffer());
  const dataUri = `data:${file.type};base64,${buf.toString("base64")}`;
  const row = await getGuildRow(guildId).catch(() => null);
  const current = normalizeBranding(row?.branding);
  const branding = normalizeBranding({ nickname: current.nickname, avatarDataUri: dataUri });
  if (!branding.avatarDataUri) return back("err=type");
  await saveGuildSection(guildId, { branding });
  return back("saved=1");
}
