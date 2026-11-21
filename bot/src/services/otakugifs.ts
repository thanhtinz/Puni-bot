/**
 * otakugifs.xyz client — spec 6.9.1.
 * Verified live 2026-11-21: all 69 reactions return HTTP 200 with a `url`
 * field, no API key. Results are cached briefly per reaction to be gentle
 * on the upstream API; a failed fetch returns null so the caller can send
 * the text line without an image instead of failing the whole command.
 */
import { otakuGifUrl } from "@puni/shared";

interface CacheEntry {
  url: string;
  expiresAt: number;
}

const CACHE_TTL_MS = 30_000;
const cache = new Map<string, CacheEntry>();

export async function fetchReactionGif(reaction: string): Promise<string | null> {
  const now = Date.now();
  const hit = cache.get(reaction);
  if (hit && hit.expiresAt > now) return hit.url;
  try {
    const res = await fetch(otakuGifUrl(reaction));
    if (!res.ok) return null;
    const body = (await res.json()) as { url?: unknown };
    if (typeof body.url !== "string" || !body.url.startsWith("https://")) return null;
    cache.set(reaction, { url: body.url, expiresAt: now + CACHE_TTL_MS });
    return body.url;
  } catch {
    return null;
  }
}
