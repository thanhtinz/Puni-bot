/**
 * Reaction GIF system — spec 6.9.
 * 69 reactions served by ONE handler and ONE data table (never 69 handlers).
 * The default Vietnamese templates below are generated from the approved
 * spec table (docs/DAC-TA-PUNI-BOT-v3.md section 6.9.4) into
 * reactions-data.json; per-guild overrides (enabled flag, edited templates,
 * cooldown) live in the bot database and are layered on top at runtime.
 */
import data from "./reactions-data.json";

export interface ReactionDef {
  /** Reaction name = prefix command name = otakugifs.xyz `reaction` parameter. */
  name: string;
  /** Template used when a user is tagged. Placeholders: {người gửi} {người nhận} {tên bot} */
  tagText: string;
  /** Template used when nobody is tagged (solo teasing line). */
  soloText: string;
}

export const REACTIONS: ReactionDef[] = data as ReactionDef[];

const byName = new Map(REACTIONS.map((r) => [r.name, r]));

export function getReaction(name: string): ReactionDef | undefined {
  return byName.get(name.toLowerCase());
}

export function renderReactionText(
  def: ReactionDef,
  opts: { sender: string; target?: string; botName: string },
): string {
  const tpl = opts.target ? def.tagText : def.soloText;
  return tpl
    .replaceAll("{người gửi}", opts.sender)
    .replaceAll("{người nhận}", opts.target ?? "")
    .replaceAll("{tên bot}", opts.botName);
}

/** otakugifs.xyz endpoint builder — verified live 2026-11-21: all 69
 *  reactions returned HTTP 200 with a `url` field, no API key required. */
export function otakuGifUrl(reaction: string, format: "gif" | "webp" | "avif" = "gif"): string {
  const base = `https://api.otakugifs.xyz/gif?reaction=${encodeURIComponent(reaction)}`;
  return format === "gif" ? base : `${base}&format=${format}`;
}
