import { NextResponse } from "next/server";
import { adminGate } from "@/lib/current-session";
import { getGuildRow, saveGuildSection } from "@/lib/db";
import { normalizeAiChatConfig } from "@/lib/guild-config";

export const dynamic = "force-dynamic";

const MODULE_KEYS = [
  "core",
  "moderation",
  "manager",
  "role",
  "embed",
  "reaction",
  "economy",
  "games",
  "cozy",
  "community",
];

/** Owner override for one guild: prefix + module switches + AI switch.
 *  Writes through the same saveGuildSection the dashboard uses, so the
 *  bot sees exactly one config source. Other sections stay untouched. */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ guildId: string }> },
) {
  const gate = await adminGate();
  if (!gate.ok) {
    return NextResponse.json({ error: "forbidden" }, { status: 403 });
  }
  const { guildId } = await params;
  const row = await getGuildRow(guildId).catch(() => null);
  if (!row) return NextResponse.json({ error: "unknown guild" }, { status: 404 });

  const form = await req.formData();
  const prefix = String(form.get("prefix") ?? "").trim();
  if (!prefix || prefix.length > 3 || /\s/.test(prefix)) {
    return NextResponse.json({ error: "invalid prefix" }, { status: 400 });
  }
  const modules: Record<string, boolean> = { ...(row.modules ?? {}) };
  for (const key of MODULE_KEYS) {
    modules[key] = form.get(`mod_${key}`) != null;
  }
  const ai = normalizeAiChatConfig(row.ai_chat);
  ai.enabled = form.get("ai_enabled") != null;

  await saveGuildSection(guildId, { prefix, modules, aiChat: ai });
  return NextResponse.redirect(new URL(`/admin/servers/${guildId}?saved=1`, req.url), 303);
}
