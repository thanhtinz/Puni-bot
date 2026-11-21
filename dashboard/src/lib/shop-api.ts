/**
 * Server-side client for the Shop internal bot API (/api/bot/v1/) —
 * used by the owner admin panel (reseller management). The bot key
 * lives ONLY in this server's environment; it never reaches the
 * browser.
 */

function baseUrl(): string {
  return (process.env.SHOP_API_BASE_URL || "").replace(/\/$/, "");
}

function botKey(): string {
  return process.env.SHOP_BOT_KEY || "";
}

export function shopApiConfigured(): boolean {
  return Boolean(baseUrl() && botKey());
}

export async function shopApi<T = any>(path: string, init: RequestInit = {}): Promise<T> {
  if (!shopApiConfigured()) throw new Error("Chưa cấu hình SHOP_API_BASE_URL / SHOP_BOT_KEY.");
  const res = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "X-Bot-Key": botKey(),
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
  const body = (await res.json().catch(() => ({}))) as any;
  if (!res.ok) throw new Error(body?.error || `Shop API lỗi ${res.status}`);
  return body as T;
}
