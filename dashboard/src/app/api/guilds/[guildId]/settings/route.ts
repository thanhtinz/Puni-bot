import { NextRequest, NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { canManageGuild } from "@/lib/session";
import { getGuildRow, saveGuildSection } from "@/lib/db";
import {
  formBool,
  formChannelId,
  formText,
  normalizeAiChatConfig,
  normalizeAutomodConfig,
  normalizeCommunityConfig,
  normalizeLogConfig,
  normalizeBranding,
  LOG_GROUPS,
  type CommunityConfig,
  type LogConfig,
  type AutomodConfig,
} from "@/lib/guild-config";

export const dynamic = "force-dynamic";

/**
 * Single save endpoint for every dashboard settings form. The caller
 * must be signed in AND manage the guild; the section is whitelisted
 * and every value is re-normalized server-side before it touches the
 * shared guild_settings row (the bot reads the same row).
 */
export async function POST(req: NextRequest, { params }: { params: Promise<{ guildId: string }> }) {
  const { guildId } = await params;
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  if (!canManageGuild(session, guildId)) {
    return NextResponse.json({ error: "Không có quyền quản lý server này." }, { status: 403 });
  }
  const form = await req.formData();
  const section = String(form.get("section") || "");
  const row = await getGuildRow(guildId).catch(() => null);
  const back = (page: string) =>
    NextResponse.redirect(new URL(`/dashboard/${guildId}${page}?saved=1`, req.nextUrl));

  if (section === "prefix") {
    const prefix = formText(form, "prefix", 3).trim();
    if (!prefix || /\s/.test(prefix)) {
      return NextResponse.json({ error: "Prefix phải có 1–3 ký tự và không chứa khoảng trắng." }, { status: 400 });
    }
    await saveGuildSection(guildId, { prefix });
    return back("");
  }

  if (section === "community") {
    const current = normalizeCommunityConfig(row?.community);
    const read = (name: keyof CommunityConfig) => ({
      enabled: formBool(form, `${name}_enabled`),
      channelId: formChannelId(form, `${name}_channel`),
      message: formText(form, `${name}_message`, 1000) || current[name].message,
    });
    const community: CommunityConfig = {
      welcome: read("welcome"),
      goodbye: read("goodbye"),
      boost: read("boost"),
    };
    await saveGuildSection(guildId, { community });
    return back("/community");
  }

  if (section === "aichat") {
    const aiChat = normalizeAiChatConfig({ enabled: formBool(form, "enabled") });
    await saveGuildSection(guildId, { aiChat });
    return back("/ai-chat");
  }

  if (section === "logging") {
    const groups = { ...normalizeLogConfig(row?.logging).groups };
    for (const g of LOG_GROUPS) groups[g] = formBool(form, `group_${g}`);
    const logging: LogConfig = {
      enabled: formBool(form, "enabled"),
      channelId: formChannelId(form, "channel"),
      groups,
    };
    await saveGuildSection(guildId, { logging });
    return back("/logging");
  }

  if (section === "automod") {
    const words = formText(form, "blocked_words", 4000)
      .split("\n")
      .map((w) => w.trim())
      .filter(Boolean)
      .slice(0, 200);
    const capsRatio = Number.parseFloat(formText(form, "caps_ratio", 8));
    const capsMin = Number.parseInt(formText(form, "caps_min", 8), 10);
    const automod: AutomodConfig = normalizeAutomodConfig({
      enabled: formBool(form, "enabled"),
      blockedWords: words,
      blockLinks: formBool(form, "block_links"),
      capsRatio: Number.isFinite(capsRatio) ? capsRatio : 0,
      capsMinLength: Number.isInteger(capsMin) && capsMin >= 1 ? capsMin : 10,
      warnOnDelete: formBool(form, "warn_on_delete"),
    });
    await saveGuildSection(guildId, { automod });
    return back("/automod");
  }

  if (section === "branding") {
    const current = normalizeBranding(row?.branding);
    const nickname = formText(form, "nickname", 40).trim().slice(0, 32);
    const removeAvatar = formBool(form, "remove_avatar");
    const branding = normalizeBranding({
      nickname,
      avatarDataUri: removeAvatar ? "" : current.avatarDataUri,
    });
    await saveGuildSection(guildId, { branding });
    return back("/branding");
  }

  return NextResponse.json({ error: "Section không hợp lệ." }, { status: 400 });
}
