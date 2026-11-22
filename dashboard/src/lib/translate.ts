/**
 * DeepL translation for synced rulings (spec 6.37 addendum).
 *
 * Contract (DeepL API reference, read 2026-11-22): POST /v2/translate
 * with header `Authorization: DeepL-Auth-Key <key>` and a JSON body
 * { text: string[], source_lang: "EN", target_lang: "VI" }; the
 * response carries `translations` in the same order as the request.
 * Free-plan keys end in ":fx" and use api-free.deepl.com; all other
 * keys use api.deepl.com. One request may carry at most 128 KiB, so
 * callers batch. DEEPL_API_BASE overrides the host (tests).
 *
 * Everything here fails open: no key, a network error, or a bad
 * response simply means "show the English original".
 */

const MAX_BATCH_TEXTS = 50;
const MAX_BATCH_CHARS = 90_000; // safely under DeepL's 128 KiB request cap
const TIMEOUT_MS = 6_000;

export function translationConfigured(): boolean {
  return Boolean(process.env.DEEPL_API_KEY);
}

function deeplUrl(): string | null {
  const key = process.env.DEEPL_API_KEY;
  if (!key) return null;
  const base =
    process.env.DEEPL_API_BASE ??
    (key.endsWith(":fx") ? "https://api-free.deepl.com" : "https://api.deepl.com");
  return `${base}/v2/translate`;
}

/** Translate a list of English texts to Vietnamese, or return null. */
export async function translateBatch(texts: string[]): Promise<string[] | null> {
  const key = process.env.DEEPL_API_KEY;
  const url = deeplUrl();
  if (!key || !url || texts.length === 0) return null;
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
    const data = (await res.json()) as {
      translations?: { text?: string }[];
    };
    const out = (data.translations ?? []).map((t) => t.text ?? "");
    if (out.length !== texts.length || out.some((t) => !t)) return null;
    return out;
  } catch {
    return null;
  }
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
