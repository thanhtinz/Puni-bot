/**
 * Web gacha (spec 6.23 + 6.24): the /me/gacha surface runs the SAME
 * rules as the bot's TcgGameService — same banners, rates, per-banner
 * pity, member discounts and guarantees — against the same
 * PostgreSQL. Every action is ONE transaction here (balance, pity,
 * instances and pull log commit or roll back together), which is
 * stricter than the bot's step-by-step flow but outcome-identical.
 */
import { db, getBotConfig, getUserMembership } from "./db";
import { adjustBalanceTx } from "./player";
import { bumpQuest } from "./quest-hooks";
import { normalizeMembershipTiers, effectivePerksWeb } from "./membership";

export const TCG_RARITIES = [
  "Common", "Uncommon", "Rare", "Epic", "Legendary", "Mythical", "Fabled",
] as const;
export type TcgRarity = (typeof TCG_RARITIES)[number];
export const rarityRank = (r: string): number => Math.max(0, TCG_RARITIES.indexOf(r as TcgRarity));

export interface TcgConfigWeb {
  pullCostCoins: number;
  beginnerCostCoins: number;
  rates: Record<TcgRarity, number>;
  pityEpic: number;
  pityLegendary: number;
  exchangePoints: number;
  beginnerMaxPulls: number;
}

const DEFAULT_CFG: TcgConfigWeb = {
  pullCostCoins: 500,
  beginnerCostCoins: 250,
  rates: { Common: 55, Uncommon: 25, Rare: 12, Epic: 5, Legendary: 2, Mythical: 0.7, Fabled: 0.3 },
  pityEpic: 30,
  pityLegendary: 90,
  exchangePoints: 100,
  beginnerMaxPulls: 30,
};

const clampNum = (v: unknown, min: number, max: number, fallback: number) => {
  const n = typeof v === "number" ? v : Number.NaN;
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Mirror of the bot's normalizeTcgConfig (only gacha fields). */
export function normalizeTcgConfigWeb(raw: unknown): TcgConfigWeb {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_CFG, rates: { ...DEFAULT_CFG.rates } };
  const r = raw as Partial<TcgConfigWeb> & { rates?: Partial<Record<TcgRarity, number>> };
  const rates = { ...DEFAULT_CFG.rates };
  for (const k of TCG_RARITIES) {
    if (r.rates && typeof r.rates[k] === "number") rates[k] = Math.max(0, r.rates[k]!);
  }
  return {
    pullCostCoins: clampNum(r.pullCostCoins, 0, 1_000_000, DEFAULT_CFG.pullCostCoins),
    beginnerCostCoins: clampNum(r.beginnerCostCoins, 0, 1_000_000, DEFAULT_CFG.beginnerCostCoins),
    rates,
    pityEpic: clampNum(r.pityEpic, 1, 1000, DEFAULT_CFG.pityEpic),
    pityLegendary: clampNum(r.pityLegendary, 1, 5000, DEFAULT_CFG.pityLegendary),
    exchangePoints: clampNum(r.exchangePoints, 1, 10000, DEFAULT_CFG.exchangePoints),
    beginnerMaxPulls: clampNum(r.beginnerMaxPulls, 1, 10000, DEFAULT_CFG.beginnerMaxPulls),
  };
}

export async function getTcgConfigWeb(): Promise<TcgConfigWeb> {
  try {
    return normalizeTcgConfigWeb(await getBotConfig("tcg_config"));
  } catch {
    return { ...DEFAULT_CFG, rates: { ...DEFAULT_CFG.rates } };
  }
}

export interface PityState {
  sinceEpic: number;
  sinceLegendary: number;
  totalPulls: number;
  summonPoints: number;
}
const emptyPity = (): PityState => ({ sinceEpic: 0, sinceLegendary: 0, totalPulls: 0, summonPoints: 0 });

function rollRarity(cfg: TcgConfigWeb, pity: PityState): TcgRarity {
  const rollAmong = (minRank: number): TcgRarity => {
    const tiers = TCG_RARITIES.filter((r) => rarityRank(r) >= minRank);
    const total = tiers.reduce((s, r) => s + cfg.rates[r], 0);
    let x = Math.random() * total;
    for (const r of tiers) {
      x -= cfg.rates[r];
      if (x <= 0) return r;
    }
    return tiers[tiers.length - 1]!;
  };
  if (pity.sinceLegendary + 1 >= cfg.pityLegendary) return rollAmong(rarityRank("Legendary"));
  if (pity.sinceEpic + 1 >= cfg.pityEpic) return rollAmong(rarityRank("Epic"));
  return rollAmong(0);
}

function advancePity(pity: PityState, rarity: TcgRarity): PityState {
  return {
    sinceEpic: rarityRank(rarity) >= rarityRank("Epic") ? 0 : pity.sinceEpic + 1,
    sinceLegendary: rarityRank(rarity) >= rarityRank("Legendary") ? 0 : pity.sinceLegendary + 1,
    totalPulls: pity.totalPulls + 1,
    summonPoints: pity.summonPoints + 1,
  };
}

interface PoolSpecies {
  id: string;
  rarity: TcgRarity;
  memberExclusive: boolean;
}

function pickSpecies(pool: PoolSpecies[], rarity: TcgRarity, featured: string[]): PoolSpecies | null {
  const ofRarity = pool.filter((s) => s.rarity === rarity);
  if (ofRarity.length === 0) return null;
  const weighted = ofRarity.map((s) => ({ s, w: featured.includes(s.id) ? 5 : 1 }));
  const total = weighted.reduce((a, b) => a + b.w, 0);
  let x = Math.random() * total;
  for (const { s, w } of weighted) {
    x -= w;
    if (x <= 0) return s;
  }
  return weighted[weighted.length - 1]!.s;
}

const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
function newInstanceCode(): string {
  let out = "";
  for (let i = 0; i < 8; i++) out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  return out;
}

export interface BannerRow {
  id: string;
  name: string;
  kind: string;
  featuredSpecies: string[];
  poolSpecies: string[];
  poolPrefix: string | null;
  costCoins: number;
  endsAt: Date | null;
  imageUrl: string | null;
}

export async function listActiveBannersWeb(): Promise<BannerRow[]> {
  try {
    const res = await db().query(
      `SELECT id, name, kind, featured_species, pool_species, pool_prefix, cost_coins::text AS cost, ends_at, image_url
       FROM tcg_banners
       WHERE enabled AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())
       ORDER BY id`,
    );
    return res.rows.map((r) => ({
      id: r.id, name: r.name, kind: r.kind,
      featuredSpecies: r.featured_species ?? [], poolSpecies: r.pool_species ?? [],
      poolPrefix: r.pool_prefix ?? null,
      costCoins: Number.parseInt(r.cost, 10), endsAt: r.ends_at,
      imageUrl: r.image_url ?? null,
    }));
  } catch {
    return [];
  }
}

export async function getPityWeb(userId: string, bannerId: string): Promise<PityState> {
  try {
    const res = await db().query(
      `SELECT since_epic, since_legendary, total_pulls, summon_points FROM tcg_pity WHERE user_id = $1 AND banner_id = $2`,
      [userId, bannerId],
    );
    const r = res.rows[0];
    return r
      ? { sinceEpic: r.since_epic, sinceLegendary: r.since_legendary, totalPulls: r.total_pulls, summonPoints: r.summon_points }
      : emptyPity();
  } catch {
    return emptyPity();
  }
}

interface WebPerks {
  gachaDiscountPercent: number;
  extraFreePacksPerDay: number;
  exclusivePets: boolean;
  battleBonusPercent: number;
  xpBonusPercent: number;
}

export async function userPerksWeb(userId: string): Promise<WebPerks | null> {
  try {
    const m = await getUserMembership(userId);
    if (!m || !m.active) return null;
    const tiers = normalizeMembershipTiers(await getBotConfig("membership_tiers"));
    const perks = effectivePerksWeb(tiers, m.tier_id);
    if (!perks) return null;
    return {
      gachaDiscountPercent: perks.gachaDiscountPercent,
      extraFreePacksPerDay: perks.extraFreePacksPerDay,
      exclusivePets: perks.exclusivePets,
      battleBonusPercent: perks.battleBonusPercent,
      xpBonusPercent: perks.xpBonusPercent,
    };
  } catch {
    return null;
  }
}

export interface PullResultRow {
  code: string;
  speciesId: string;
  rarity: string;
  /** Real market price in USD when the species carries one (spec 6.29). */
  priceUsd?: number;
  /** Internal market reference price in Coins, once traded (spec 6.29). */
  marketPriceCoins?: number;
  /** Display data from game_species (reveal screen). */
  name?: string;
  spriteUrl?: string;
  setName?: string;
}
type PullOutcome =
  | { ok: true; results: PullResultRow[]; cost: number }
  | { ok: false; error: string };

type TxClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Record<string, never>[]; rowCount?: number | null }>;
};

async function loadPool(client: TxClient, perks: WebPerks | null, bannerPool: string[], poolPrefix: string | null = null): Promise<PoolSpecies[]> {
  const res = await client.query(
    `SELECT id, rarity, member_exclusive FROM game_species WHERE enabled`,
  );
  let pool = (res.rows as unknown as Array<{ id: string; rarity: string; member_exclusive: boolean }>).map((r) => ({
    id: r.id, rarity: r.rarity as TcgRarity, memberExclusive: r.member_exclusive,
  }));
  if (!perks?.exclusivePets) pool = pool.filter((s) => !s.memberExclusive);
  if (bannerPool.length) pool = pool.filter((s) => bannerPool.includes(s.id));
  // Family boundary (spec 6.37): a JP edition prefix (pkmjp-, opjp-,
  // gunjp-) is its own family and must not leak into the EN banner pool
  // that shares its leading letters.
  else if (poolPrefix) pool = pool.filter((s) => s.id.startsWith(poolPrefix) && !s.id.startsWith(`${poolPrefix}jp-`));
  return pool;
}

async function lockPity(client: TxClient, userId: string, bannerId: string): Promise<PityState> {
  await client.query(
    `INSERT INTO tcg_pity (user_id, banner_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [userId, bannerId],
  );
  const res = await client.query(
    `SELECT since_epic, since_legendary, total_pulls, summon_points FROM tcg_pity
     WHERE user_id = $1 AND banner_id = $2 FOR UPDATE`,
    [userId, bannerId],
  );
  const r = res.rows[0] as unknown as
    | { since_epic: number; since_legendary: number; total_pulls: number; summon_points: number }
    | undefined;
  return r
    ? { sinceEpic: r.since_epic, sinceLegendary: r.since_legendary, totalPulls: r.total_pulls, summonPoints: r.summon_points }
    : emptyPity();
}

async function savePity(client: TxClient, userId: string, bannerId: string, pity: PityState): Promise<void> {
  await client.query(
    `UPDATE tcg_pity SET since_epic = $3, since_legendary = $4, total_pulls = $5, summon_points = $6
     WHERE user_id = $1 AND banner_id = $2`,
    [userId, bannerId, pity.sinceEpic, pity.sinceLegendary, pity.totalPulls, pity.summonPoints],
  );
}

async function createInstanceTx(
  client: TxClient, userId: string, speciesId: string, obtained: string,
): Promise<string> {
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = newInstanceCode();
    const res = await client.query(
      `INSERT INTO tcg_instances (code, user_id, species_id, obtained) VALUES ($1, $2, $3, $4)
       ON CONFLICT (code) DO NOTHING RETURNING code`,
      [code, userId, speciesId, obtained],
    );
    if (res.rows.length) return code;
  }
  throw new Error("could not allocate instance code");
}

async function rollPulls(
  client: TxClient,
  userId: string,
  bannerId: string,
  cfg: TcgConfigWeb,
  pool: PoolSpecies[],
  featured: string[],
  count: number,
  state: PityState,
  obtained: string,
  opts: { multiGuarantee?: boolean; beginnerFirstMulti?: boolean; premiumPack?: boolean },
): Promise<{ results: PullResultRow[]; state: PityState }> {
  const results: PullResultRow[] = [];
  let st = { ...state };
  for (let i = 0; i < count; i++) {
    let rarity = rollRarity(cfg, st);
    if (opts.multiGuarantee && i === count - 1 && results.every((r) => rarityRank(r.rarity) < rarityRank("Rare"))) {
      rarity = "Rare";
    }
    if (opts.beginnerFirstMulti && i === count - 1) {
      rarity = "Legendary";
    }
    if (opts.premiumPack && i === count - 1 && results.every((r) => rarityRank(r.rarity) < rarityRank("Epic"))) {
      rarity = "Epic";
    }
    let species = pickSpecies(pool, rarity, featured);
    if (!species) {
      const lower = [...new Set(pool.map((s) => s.rarity))].sort((a, b) => rarityRank(b) - rarityRank(a))[0];
      if (!lower) break;
      rarity = lower;
      species = pickSpecies(pool, rarity, featured);
      if (!species) break;
    }
    const code = await createInstanceTx(client, userId, species.id, obtained);
    await client.query(
      `INSERT INTO tcg_pulls (user_id, banner_id, species_id, rarity, instance_code) VALUES ($1, $2, $3, $4, $5)`,
      [userId, bannerId, species.id, rarity, code],
    );
    st = advancePity(st, rarity);
    results.push({ code, speciesId: species.id, rarity });
  }
  return { results, state: st };
}

/** Paid pulls on a banner — mirror of bot TcgGameService.pull. */
export async function pullWeb(userId: string, bannerId: string, count: 1 | 10): Promise<PullOutcome> {
  const cfg = await getTcgConfigWeb();
  const perks = await userPerksWeb(userId);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const bRes = await client.query(
      `SELECT id, name, kind, featured_species, pool_species, pool_prefix, cost_coins::text AS cost
       FROM tcg_banners WHERE id = $1 AND enabled
         AND (starts_at IS NULL OR starts_at <= now()) AND (ends_at IS NULL OR ends_at > now())`,
      [bannerId],
    );
    const banner = bRes.rows[0] as unknown as
      | { id: string; name: string; kind: string; featured_species: string[]; pool_species: string[]; pool_prefix: string | null; cost: string }
      | undefined;
    if (!banner) { await client.query("ROLLBACK"); return { ok: false, error: "Banner này không còn mở." }; }
    if (banner.kind === "beginner") {
      const total = await client.query(
        `SELECT COUNT(*)::text AS n FROM tcg_pulls WHERE user_id = $1`, [userId],
      );
      const n = Number.parseInt((total.rows[0] as unknown as { n: string }).n, 10);
      if (n >= cfg.beginnerMaxPulls) {
        await client.query("ROLLBACK");
        return { ok: false, error: "Banner Tân Thủ chỉ dành cho tài khoản dưới 30 lượt mở." };
      }
    }
    const state = await lockPity(client as TxClient, userId, bannerId);
    const pool = await loadPool(client as TxClient, perks, banner.pool_species ?? [], banner.pool_prefix ?? null);
    if (pool.length === 0) { await client.query("ROLLBACK"); return { ok: false, error: "Danh mục thẻ đang trống." }; }
    const unitCost = banner.kind === "beginner"
      ? cfg.beginnerCostCoins
      : Number.parseInt(banner.cost, 10) || cfg.pullCostCoins;
    let cost = unitCost * count;
    if (perks && perks.gachaDiscountPercent > 0) {
      cost = Math.max(0, Math.floor((cost * (100 - perks.gachaDiscountPercent)) / 100));
    }
    if (cost > 0) {
      const paid = await adjustBalanceTx(client, userId, -cost, "tcg-gacha", `Mở thẻ banner ${banner.name} (web)`);
      if (!paid) {
        await client.query("ROLLBACK");
        return { ok: false, error: `Không đủ Coins — cần ${cost.toLocaleString("en-US", { maximumFractionDigits: 4 })}.` };
      }
    }
    const { results, state: next } = await rollPulls(
      client as TxClient, userId, bannerId, cfg, pool, banner.featured_species ?? [], count, state, "gacha",
      {
        multiGuarantee: count === 10,
        beginnerFirstMulti: banner.kind === "beginner" && count === 10 && state.totalPulls === 0,
      },
    );
    await savePity(client as TxClient, userId, bannerId, next);
    await client.query("COMMIT");
    await bumpQuest(userId, "pull", results.length);
    return { ok: true, results, cost };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi mở thẻ, thử lại sau." };
  } finally {
    client.release();
  }
}

/** Open a standard/premium pack from the wallet — mirror of bot openPack. */
export async function openPackWeb(userId: string, premium: boolean): Promise<PullOutcome> {
  const cfg = await getTcgConfigWeb();
  const perks = await userPerksWeb(userId);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO tcg_wallets (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [userId],
    );
    const wRes = await client.query(
      `SELECT packs_standard, packs_premium FROM tcg_wallets WHERE user_id = $1 FOR UPDATE`, [userId],
    );
    const w = wRes.rows[0] as unknown as { packs_standard: number; packs_premium: number };
    if (premium && w.packs_premium <= 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Bạn không có Gói Cao Cấp nào." };
    }
    if (!premium && w.packs_standard <= 0) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Bạn không có Gói Thường nào." };
    }
    await client.query(
      `UPDATE tcg_wallets SET ${premium ? "packs_premium" : "packs_standard"} = ${premium ? "packs_premium" : "packs_standard"} - 1 WHERE user_id = $1`,
      [userId],
    );
    const state = await lockPity(client as TxClient, userId, "standard");
    const pool = await loadPool(client as TxClient, perks, []);
    if (pool.length === 0) { await client.query("ROLLBACK"); return { ok: false, error: "Danh mục thẻ đang trống." }; }
    const { results, state: next } = await rollPulls(
      client as TxClient, userId, "standard", cfg, pool, [], 5, state,
      premium ? "pack-premium" : "pack",
      { premiumPack: premium },
    );
    await savePity(client as TxClient, userId, "standard", next);
    await client.query("COMMIT");
    await bumpQuest(userId, "pull", results.length);
    return { ok: true, results, cost: 0 };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi khi mở gói, thử lại sau." };
  } finally {
    client.release();
  }
}

/** Daily free pack claim — mirror of bot `gacha free`. */
export async function claimFreePackWeb(userId: string): Promise<{ ok: true; packs: number } | { ok: false; error: string }> {
  const perks = await userPerksWeb(userId);
  const packs = 1 + (perks?.extraFreePacksPerDay ?? 0);
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const period = new Date().toISOString().slice(0, 10);
    const ins = await client.query(
      `INSERT INTO tcg_claims (user_id, kind, period) VALUES ($1, 'daily', $2)
       ON CONFLICT DO NOTHING RETURNING user_id`,
      [userId, period],
    );
    if (!ins.rows.length) {
      await client.query("ROLLBACK");
      return { ok: false, error: "Bạn đã nhận gói miễn phí hôm nay rồi." };
    }
    await client.query(
      `INSERT INTO tcg_wallets (user_id, packs_standard) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET packs_standard = tcg_wallets.packs_standard + $2`,
      [userId, packs],
    );
    await client.query("COMMIT");
    return { ok: true, packs };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Có lỗi, thử lại sau." };
  } finally {
    client.release();
  }
}

/** Instances by code, for the reveal strip (ownership-checked). */
export async function revealInstances(userId: string, codes: string[]): Promise<PullResultRow[]> {
  if (!codes.length) return [];
  try {
    const res = await db().query(
      `SELECT i.code, i.species_id, s.rarity, s.price_usd, s.market_price_coins,
              s.name AS sp_name, s.sprite_url, COALESCE(g.name, s.set_id) AS set_name
       FROM tcg_instances i
       LEFT JOIN game_species s ON s.id = i.species_id
       LEFT JOIN game_sets g ON g.id = s.set_id
       WHERE i.user_id = $1 AND i.code = ANY($2)`,
      [userId, codes],
    );
    const byCode = new Map(res.rows.map((r) => [r.code as string, r]));
    return codes
      .map((c) => byCode.get(c))
      .filter(Boolean)
      .map((r) => ({
        code: r!.code as string,
        speciesId: r!.species_id as string,
        rarity: (r!.rarity as string) ?? "Common",
        priceUsd: r!.price_usd != null ? Number(r!.price_usd) : undefined,
        marketPriceCoins: r!.market_price_coins != null ? Number(r!.market_price_coins) : undefined,
        name: (r!.sp_name as string) ?? undefined,
        spriteUrl: (r!.sprite_url as string) ?? undefined,
        setName: (r!.set_name as string) ?? undefined,
      }));
  } catch {
    return [];
  }
}
