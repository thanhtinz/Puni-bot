/**
 * Machine translation for synced rulings (spec 6.37 addendum).
 *
 * Two engines, chosen by environment, best first:
 *
 * 1. DeepL (DEEPL_API_KEY set). Contract from the DeepL API reference
 *    (read 2026-11-22): POST /v2/translate with header
 *    `Authorization: DeepL-Auth-Key <key>` and JSON { text: string[],
 *    source_lang: "EN", target_lang: "VI" }; `translations` come back
 *    in request order. Free-plan keys end in ":fx" and use
 *    api-free.deepl.com. One request may carry at most 128 KiB.
 *    Note: even the DeepL free plan demands a payment card on file.
 *
 * 2. LibreTranslate-compatible sidecar (LIBRETRANSLATE_URL set, e.g.
 *    http://127.0.0.1:5000): POST /translate with JSON { q: string[],
 *    source: "en", target: "vi", format: "text" } returns
 *    { translatedText: string[] }. The repo ships a self-hosted
 *    Argos Translate sidecar (tools/translate-sidecar) speaking this
 *    shape — fully free, no card, no quota; quality is below DeepL.
 *
 * DEEPL_API_BASE overrides the DeepL host (tests). Everything fails
 * open: no engine, a network error, or a bad response simply means
 * "show the English original".
 */

const MAX_BATCH_TEXTS = 50;
const MAX_BATCH_CHARS = 90_000; // safely under DeepL's 128 KiB request cap
const TIMEOUT_MS = 6_000;
const LIBRE_TIMEOUT_MS = 60_000; // local CPU translation is slower

export function translationConfigured(): boolean {
  return Boolean(process.env.DEEPL_API_KEY || process.env.LIBRETRANSLATE_URL);
}

/**
 * How many distinct texts one page view may translate. DeepL is a
 * fast hosted API, so a whole card (up to 100) is fine. The local
 * sidecar translates on CPU at seconds per text, so a view takes at
 * most 10 — rulings arrive ordered species-first, so the card's own
 * rulings translate first and the rest follow on later views.
 */
export function translationViewCap(): number {
  return process.env.DEEPL_API_KEY ? 100 : 10;
}

function deeplUrl(): string | null {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;
  const base =
    process.env.DEEPL_API_BASE ??
    (key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
  return `${base}/v2/translate`;
}

async function translateBatchDeepL(texts: string[]): Promise<string[] | null> {
  const key = process.env.DEEPL_API_KEY;
  const url = deeplUrl();
  if (!key || !url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `DeepL-Auth-Key ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: texts,
        source_lang: "EN",
        target_lang: "VI",
        preserve_formatting: true,
      }),
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { translations?: { text?: string }[] };
    const out = (data.translations ?? []).map((t) => t.text ?? "");
    if (out.length !== texts.length || out.some((t) => !t)) return null;
    return out;
  } catch {
    return null;
  }
}

async function translateBatchLibre(texts: string[]): Promise<string[] | null> {
  const base = process.env.LIBRETRANSLATE_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base.replace(/\/$/, "")}/translate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ q: texts, source: "en", target: "vi", format: "text" }),
      signal: AbortSignal.timeout(LIBRE_TIMEOUT_MS),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { translatedText?: string[] };
    const out = data.translatedText ?? [];
    if (out.length !== texts.length || out.some((t) => !t)) return null;
    return out;
  } catch {
    return null;
  }
}

/** Translate one batch with the configured engine, or return null. */
export async function translateBatch(texts: string[]): Promise<string[] | null> {
  if (texts.length === 0) return null;
  if (process.env.DEEPL_API_KEY) return translateBatchDeepL(texts);
  return translateBatchLibre(texts);
}

/**
 * Translate many texts with per-request batching. Returns a map from
 * source text to translation for every text that succeeded; texts in
 * a failed batch are simply absent (the caller falls back to English
 * and a later view retries).
 */
export async function translateMany(texts: string[]): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const queue = [...texts];
  while (queue.length > 0) {
    const batch: string[] = [];
    let chars = 0;
    while (
      queue.length > 0 &&
      batch.length < MAX_BATCH_TEXTS &&
      chars + queue[0].length <= MAX_BATCH_CHARS
    ) {
      const next = queue.shift()!;
      batch.push(next);
      chars += next.length;
    }
    if (batch.length === 0) break; // single text over the cap — skip it
    const translated = await translateBatch(batch);
    if (translated) {
      batch.forEach((src, i) => result.set(src, translated[i]));
    }
  }
  return result;
}
