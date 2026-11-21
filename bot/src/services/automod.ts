/**
 * Automod — spec 6.7 (v1 rules: blocked words, links, caps).
 * Pure decision function over the guild's automod config; the client
 * performs the actual delete/warn. Members with mod rank or higher are
 * exempt — automod never acts against staff.
 */
import type { AutomodConfig } from "../moderation-config";
import type { PermissionRank } from "../dispatcher";

export type AutomodVerdict =
  | { action: "none" }
  | { action: "delete"; rule: "blocked-word" | "link" | "caps"; detail: string };

const LINK_RE = /https?:\/\/\S+/i;

export function checkAutomod(
  config: AutomodConfig,
  input: { content: string; authorRank: PermissionRank },
): AutomodVerdict {
  if (!config.enabled) return { action: "none" };
  if (input.authorRank >= 1) return { action: "none" };
  const content = input.content ?? "";
  if (!content) return { action: "none" };

  const lower = content.toLowerCase();
  for (const word of config.blockedWords) {
    const w = word.trim().toLowerCase();
    if (w && lower.includes(w)) {
      return { action: "delete", rule: "blocked-word", detail: w };
    }
  }

  if (config.blockLinks && LINK_RE.test(content)) {
    return { action: "delete", rule: "link", detail: "link" };
  }

  if (config.capsRatio > 0) {
    const letters = content.replace(/[^A-Za-zÀ-ỹ]/g, "");
    if (letters.length >= config.capsMinLength) {
      const upper = letters.replace(/[^A-ZÀ-Ỹ]/g, "").length;
      if (letters.length > 0 && upper / letters.length > config.capsRatio) {
        return { action: "delete", rule: "caps", detail: `${Math.round((upper / letters.length) * 100)}% caps` };
      }
    }
  }

  return { action: "none" };
}
