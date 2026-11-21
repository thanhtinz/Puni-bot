/**
 * Client for the Shop internal bot API `/api/bot/v1/` — spec 4.3.
 * The bot NEVER touches the Shop database; this client is the only bridge.
 *
 * Rules baked in:
 * - Auth is the dedicated bot key (`X-Bot-Key`) — never a reseller/agent key.
 * - Every SALES action carries `guildId`: Shop re-checks server-side that
 *   the guild is declared as a sales guild (spec 6.11), so a bot-side
 *   mistake cannot sell in an undeclared guild.
 * - Money actions are never auto-retried: a timed-out pay/buy may already
 *   have landed server-side, and Shop enforces exactly-once by order code
 *   (+ the idempotency key we forward when the caller supplies one).
 * - Errors surface as ShopApiError with the HTTP status and Shop's message.
 */

export class ShopApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body?: unknown,
  ) {
    super(message);
    this.name = "ShopApiError";
  }
}

export interface ShopApiClientOptions {
  baseUrl: string; // e.g. https://bntshop.com/api/bot/v1
  botKey: string;
  timeoutMs?: number;
  fetchImpl?: typeof fetch;
}

interface RequestOpts {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  query?: Record<string, string | undefined>;
  body?: Record<string, unknown>;
  idempotencyKey?: string;
}

export class ShopApiClient {
  private baseUrl: string;
  private timeoutMs: number;
  private fetchImpl: typeof fetch;

  constructor(private opts: ShopApiClientOptions) {
    if (!opts.botKey) throw new Error("ShopApiClient: bot key is required");
    this.baseUrl = opts.baseUrl.replace(/\/+$/, "");
    this.timeoutMs = opts.timeoutMs ?? 10_000;
    this.fetchImpl = opts.fetchImpl ?? fetch;
  }

  async request<T>(path: string, req: RequestOpts = {}): Promise<T> {
    const url = new URL(`${this.baseUrl}${path}`);
    for (const [k, v] of Object.entries(req.query ?? {})) {
      if (v !== undefined) url.searchParams.set(k, v);
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    let res: Response;
    try {
      res = await this.fetchImpl(url, {
        method: req.method ?? "GET",
        headers: {
          "Content-Type": "application/json",
          "X-Bot-Key": this.opts.botKey,
          ...(req.idempotencyKey ? { "Idempotency-Key": req.idempotencyKey } : {}),
        },
        body: req.body ? JSON.stringify(req.body) : undefined,
        signal: controller.signal,
      });
    } catch (err) {
      throw new ShopApiError(0, `Shop API unreachable: ${(err as Error).message}`);
    } finally {
      clearTimeout(timer);
    }
    const text = await res.text();
    let body: unknown = undefined;
    try {
      body = text ? JSON.parse(text) : undefined;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const msg =
        (body as { error?: string; message?: string } | undefined)?.error ??
        (body as { message?: string } | undefined)?.message ??
        `Shop API error ${res.status}`;
      throw new ShopApiError(res.status, msg, body);
    }
    return body as T;
  }

  // ---- Catalog / product (read) ----
  getCatalog<T = unknown>() {
    return this.request<T>("/catalog");
  }
  searchCatalog<T = unknown>(q: string) {
    return this.request<T>("/catalog/search", { query: { q } });
  }
  getProduct<T = unknown>(id: string) {
    return this.request<T>(`/product/${encodeURIComponent(id)}`);
  }

  // ---- Wallet / Pass / Cashback / Rank (read, per customer) ----
  getWallet<T = unknown>(discordId: string) {
    return this.request<T>("/wallet", { query: { discordId } });
  }
  getPass<T = unknown>(discordId: string) {
    return this.request<T>("/pass", { query: { discordId } });
  }
  getCashback<T = unknown>(discordId: string) {
    return this.request<T>("/cashback", { query: { discordId } });
  }
  getRank<T = unknown>(discordId: string) {
    return this.request<T>("/rank", { query: { discordId } });
  }
  getLeaderboard<T = unknown>(period?: string) {
    return this.request<T>("/leaderboard", { query: { period } });
  }

  // ---- Orders (sales: guildId always attached, spec 6.11) ----
  createOrder<T = unknown>(input: {
    guildId: string;
    discordId: string;
    productId: string;
    variantId?: string;
    paymentMethod: string;
    promoCode?: string;
    idempotencyKey?: string;
  }) {
    const { idempotencyKey, ...body } = input;
    return this.request<T>("/orders", { method: "POST", body, idempotencyKey });
  }
  getOrder<T = unknown>(code: string) {
    return this.request<T>(`/orders/${encodeURIComponent(code)}`);
  }
  listOrders<T = unknown>(discordId: string) {
    return this.request<T>("/orders", { query: { discordId } });
  }
  payOrderWithWallet<T = unknown>(code: string, guildId: string, idempotencyKey?: string) {
    return this.request<T>(`/orders/${encodeURIComponent(code)}/pay-wallet`, {
      method: "POST",
      body: { guildId },
      idempotencyKey,
    });
  }
  cancelOrder<T = unknown>(code: string, guildId: string) {
    return this.request<T>(`/orders/${encodeURIComponent(code)}/cancel`, {
      method: "POST",
      body: { guildId },
    });
  }

  // ---- Deposits ----
  createDepositIntent<T = unknown>(input: {
    guildId: string;
    discordId: string;
    method: string;
    amount?: number;
  }) {
    return this.request<T>("/deposits/intent", { method: "POST", body: { ...input } });
  }
  getDeposit<T = unknown>(code: string) {
    return this.request<T>(`/deposits/${encodeURIComponent(code)}`);
  }

  // ---- Pass / Cashback purchase (money actions: exactly-once by Shop) ----
  buyPass<T = unknown>(input: { guildId: string; discordId: string; idempotencyKey?: string }) {
    const { idempotencyKey, ...body } = input;
    return this.request<T>("/pass/buy", { method: "POST", body, idempotencyKey });
  }
  buyCashback<T = unknown>(input: {
    guildId: string;
    discordId: string;
    itemId: string;
    idempotencyKey?: string;
  }) {
    const { idempotencyKey, ...body } = input;
    return this.request<T>("/cashback/buy", { method: "POST", body, idempotencyKey });
  }

  // ---- Promo (channel DISCORD codes) ----
  validatePromo<T = unknown>(input: { guildId: string; code: string; orderCode?: string }) {
    return this.request<T>("/promo/validate", { method: "POST", body: { ...input } });
  }
  listPromos<T = unknown>() {
    return this.request<T>("/promo/list");
  }

  // ---- Feedback ----
  createFeedback<T = unknown>(input: { guildId: string; discordId: string; orderCode: string; rating: number; text?: string }) {
    return this.request<T>("/feedback", { method: "POST", body: { ...input } });
  }

  // ---- Resellers (owner admin panel only; data lives in Shop, spec 6.12) ----
  listResellers<T = unknown>() {
    return this.request<T>("/resellers");
  }
  createReseller<T = unknown>(input: { discordId: string; discountPercent: number; guildIds?: string[] }) {
    return this.request<T>("/resellers", { method: "POST", body: { ...input } });
  }
  updateReseller<T = unknown>(id: string, patch: { discountPercent?: number; guildIds?: string[]; locked?: boolean }) {
    return this.request<T>(`/resellers/${encodeURIComponent(id)}`, { method: "PATCH", body: { ...patch } });
  }
  getResellerWallet<T = unknown>(id: string) {
    return this.request<T>(`/resellers/${encodeURIComponent(id)}/wallet`);
  }
}
