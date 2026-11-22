import { db, getBotConfig, getUserMembership } from "@/lib/db";
import { adjustBalanceTx, cardValue, fmtCoins } from "@/lib/player";
import { getPriceCoinsPerUsd } from "@/lib/tcg";

export { fmtCoins };

/** Collection Showcase (spec 6.30) — a purchasable, customizable
 *  display page for a player's rarest cards. Premium members own it
 *  as part of their tier. All money moves go through transactions and
 *  the shared adjustBalanceTx ledger writer. */

export interface ShowcaseTheme { id: string; name: string; price: number }
export const SHOWCASE_THEMES: ShowcaseTheme[] = [
  { id: "classic", name: "Cổ điển", price: 0 },
  { id: "forest", name: "Rừng xanh", price: 0 },
  { id: "mono", name: "Đơn sắc", price: 0 },
  { id: "sunset", name: "Hoàng hôn", price: 2000 },
  { id: "sakura", name: "Anh đào", price: 2000 },
  { id: "royal", name: "Hoàng gia", price: 3500 },
];
export const SHOWCASE_LAYOUTS = [
  { id: "grid", name: "Lưới" },
  { id: "shelf", name: "Kệ ngang" },
  { id: "spotlight", name: "Tâm điểm" },
] as const;
export const SHOWCASE_EFFECTS = [
  { id: "none", name: "Không hiệu ứng" },
  { id: "holo", name: "Holo cầu vồng (lá Epic+)" },
  { id: "shine", name: "Lướt sáng" },
] as const;
export const SHOWCASE_MAX_PINS = 12;
const DEFAULT_SHOWCASE_PRICE = 5000;

export interface ShowcaseRow {
  userId: string;
  owned: boolean;
  isPublic: boolean;
  layout: string;
  theme: string;
  effect: string;
  pins: string[];
  unlockedThemes: string[];
}

export interface ShowcaseCard {
  code: string;
  name: string;
  rarity: string;
  spriteUrl: string;
  level: number;
  enhance: number;
  value: number;
}

type TxResult = { ok: true } | { ok: false; error: string };

export async function getShowcasePrice(): Promise<number> {
  try {
    const cfg = await getBotConfig<{ showcasePriceCoins?: number }>("tcg_config");
    const v = cfg?.showcasePriceCoins;
    return typeof v === "number" && v >= 0 ? v : DEFAULT_SHOWCASE_PRICE;
  } catch {
    return DEFAULT_SHOWCASE_PRICE;
  }
}

/** Premium tier includes the showcase (spec 6.30 + membership table). */
export async function hasPremiumShowcase(userId: string): Promise<boolean> {
  try {
    const m = await getUserMembership(userId);
    return !!m && m.active && m.tier_id === "premium";
  } catch {
    return false;
  }
}

export async function getShowcase(userId: string): Promise<ShowcaseRow> {
  const premium = await hasPremiumShowcase(userId);
  try {
    const res = await db().query(
      `SELECT user_id, owned, is_public, layout, theme, effect, pins, unlocked_themes
       FROM tcg_showcases WHERE user_id = $1`,
      [userId],
    );
    const r = res.rows[0] as Record<string, unknown> | undefined;
    if (!r) {
      return {
        userId, owned: premium, isPublic: true, layout: "grid", theme: "classic",
        effect: "none", pins: [], unlockedThemes: [],
      };
    }
    return {
      userId,
      owned: Boolean(r.owned) || premium,
      isPublic: Boolean(r.is_public),
      layout: String(r.layout), theme: String(r.theme), effect: String(r.effect),
      pins: (r.pins as string[]) ?? [],
      unlockedThemes: (r.unlocked_themes as string[]) ?? [],
    };
  } catch {
    return {
      userId, owned: premium, isPublic: true, layout: "grid", theme: "classic",
      effect: "none", pins: [], unlockedThemes: [],
    };
  }
}

export function themeUnlocked(sc: ShowcaseRow, themeId: string): boolean {
  const t = SHOWCASE_THEMES.find((x) => x.id === themeId);
  if (!t) return false;
  return t.price <= 0 || sc.unlockedThemes.includes(themeId);
}

export async function buyShowcase(userId: string): Promise<TxResult> {
  const sc = await getShowcase(userId);
  if (sc.owned) return { ok: false, error: "Bạn đã có trang trưng bày rồi." };
  const price = await getShowcasePrice();
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const paid = await adjustBalanceTx(client, userId, -price, "showcase", "Mở trang trưng bày bộ sưu tập");
    if (!paid) {
      await client.query("ROLLBACK");
      return { ok: false, error: `Không đủ Coins — cần ${fmtCoins(price)} Coins.` };
    }
    await client.query(
      `INSERT INTO tcg_showcases (user_id, owned) VALUES ($1, TRUE)
       ON CONFLICT (user_id) DO UPDATE SET owned = TRUE, updated_at = now()`,
      [userId],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Không mua được trang trưng bày, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function buyShowcaseTheme(userId: string, themeId: string): Promise<TxResult> {
  const theme = SHOWCASE_THEMES.find((x) => x.id === themeId);
  if (!theme) return { ok: false, error: "Nền không tồn tại." };
  const sc = await getShowcase(userId);
  if (!sc.owned) return { ok: false, error: "Bạn chưa có trang trưng bày." };
  if (themeUnlocked(sc, themeId)) return { ok: false, error: "Nền này đã mở khoá rồi." };
  const client = await db().connect();
  try {
    await client.query("BEGIN");
    const paid = await adjustBalanceTx(client, userId, -theme.price, "showcase", `Mở khoá nền trưng bày ${theme.name}`);
    if (!paid) {
      await client.query("ROLLBACK");
      return { ok: false, error: `Không đủ Coins — cần ${fmtCoins(theme.price)} Coins.` };
    }
    await client.query(
      `INSERT INTO tcg_showcases (user_id, owned, unlocked_themes) VALUES ($1, TRUE, ARRAY[$2])
       ON CONFLICT (user_id) DO UPDATE
         SET unlocked_themes = array_append(tcg_showcases.unlocked_themes, $2), updated_at = now()`,
      [userId, themeId],
    );
    await client.query("COMMIT");
    return { ok: true };
  } catch {
    await client.query("ROLLBACK").catch(() => undefined);
    return { ok: false, error: "Không mở khoá được nền, thử lại sau." };
  } finally {
    client.release();
  }
}

export async function saveShowcase(
  userId: string,
  input: { layout: string; theme: string; effect: string; isPublic: boolean },
): Promise<TxResult> {
  const sc = await getShowcase(userId);
  if (!sc.owned) return { ok: false, error: "Bạn chưa có trang trưng bày." };
  if (!SHOWCASE_LAYOUTS.some((l) => l.id === input.layout)) return { ok: false, error: "Bố cục không hợp lệ." };
  if (!SHOWCASE_EFFECTS.some((e) => e.id === input.effect)) return { ok: false, error: "Hiệu ứng không hợp lệ." };
  if (!SHOWCASE_THEMES.some((t) => t.id === input.theme)) return { ok: false, error: "Nền không tồn tại." };
  if (!themeUnlocked(sc, input.theme)) return { ok: false, error: "Nền này chưa mở khoá." };
  await db().query(
    `INSERT INTO tcg_showcases (user_id, owned, is_public, layout, theme, effect)
     VALUES ($1, TRUE, $2, $3, $4, $5)
     ON CONFLICT (user_id) DO UPDATE
       SET is_public = $2, layout = $3, theme = $4, effect = $5, updated_at = now()`,
    [userId, input.isPublic, input.layout, input.theme, input.effect],
  );
  return { ok: true };
}

export async function setShowcasePin(userId: string, code: string, pin: boolean): Promise<TxResult> {
  const sc = await getShowcase(userId);
  if (!sc.owned) return { ok: false, error: "Bạn chưa có trang trưng bày." };
  const clean = code.trim().toUpperCase();
  if (pin) {
    if (sc.pins.includes(clean)) return { ok: false, error: "Thẻ này đã được ghim." };
    if (sc.pins.length >= SHOWCASE_MAX_PINS) {
      return { ok: false, error: `Chỉ ghim tối đa ${SHOWCASE_MAX_PINS} thẻ.` };
    }
    const own = await db().query(
      `SELECT 1 FROM tcg_instances WHERE code = $1 AND user_id = $2`,
      [clean, userId],
    );
    if (own.rows.length === 0) return { ok: false, error: "Thẻ không thuộc về bạn." };
  }
  const pins = pin ? [...sc.pins, clean] : sc.pins.filter((p) => p !== clean);
  await db().query(
    `INSERT INTO tcg_showcases (user_id, owned, pins) VALUES ($1, TRUE, $2)
     ON CONFLICT (user_id) DO UPDATE SET pins = $2, updated_at = now()`,
    [userId, pins],
  );
  return { ok: true };
}

/** Resolve pins to display cards. Pins whose instance left the
 *  collection (sold/traded) silently drop out (spec 6.30). */
export async function getShowcaseCards(userId: string, pins: string[]): Promise<ShowcaseCard[]> {
  if (pins.length === 0) return [];
  const rate = await getPriceCoinsPerUsd();
  const res = await db().query(
    `SELECT i.code, i.level, i.enhance, s.name, s.rarity, s.sprite_url,
            s.price_usd::text AS price_usd, s.market_price_coins::text AS market_price
     FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
     WHERE i.user_id = $1 AND i.code = ANY($2)`,
    [userId, pins],
  );
  const byCode = new Map<string, ShowcaseCard>();
  for (const r of res.rows as Record<string, unknown>[]) {
    const priceUsd = r.price_usd != null ? Number(r.price_usd) : undefined;
    const market = r.market_price != null ? Number(r.market_price) : undefined;
    byCode.set(String(r.code), {
      code: String(r.code),
      name: String(r.name),
      rarity: String(r.rarity),
      spriteUrl: String(r.sprite_url ?? ""),
      level: Number(r.level),
      enhance: Number(r.enhance),
      value: cardValue(String(r.rarity), Number(r.level), Number(r.enhance), priceUsd, rate, market),
    });
  }
  return pins.map((p) => byCode.get(p)).filter((c): c is ShowcaseCard => !!c);
}

/** Instances the owner can pin — rarest first, capped for page size. */
export async function listPinnableCards(userId: string): Promise<ShowcaseCard[]> {
  const rate = await getPriceCoinsPerUsd();
  const res = await db().query(
    `SELECT i.code, i.level, i.enhance, s.name, s.rarity, s.sprite_url,
            s.price_usd::text AS price_usd, s.market_price_coins::text AS market_price
     FROM tcg_instances i JOIN game_species s ON s.id = i.species_id
     WHERE i.user_id = $1
     ORDER BY CASE s.rarity WHEN 'Fabled' THEN 7 WHEN 'Mythical' THEN 6 WHEN 'Legendary' THEN 5
              WHEN 'Epic' THEN 4 WHEN 'Rare' THEN 3 WHEN 'Uncommon' THEN 2 ELSE 1 END DESC,
              i.level DESC, i.enhance DESC
     LIMIT 60`,
    [userId],
  );
  return (res.rows as Record<string, unknown>[]).map((r) => ({
    code: String(r.code),
    name: String(r.name),
    rarity: String(r.rarity),
    spriteUrl: String(r.sprite_url ?? ""),
    level: Number(r.level),
    enhance: Number(r.enhance),
    value: cardValue(
      String(r.rarity), Number(r.level), Number(r.enhance),
      r.price_usd != null ? Number(r.price_usd) : undefined, rate,
      r.market_price != null ? Number(r.market_price) : undefined,
    ),
  }));
}

export async function getPublicShowcase(userId: string): Promise<{ sc: ShowcaseRow; cards: ShowcaseCard[] } | null> {
  const sc = await getShowcase(userId);
  if (!sc.owned || !sc.isPublic) return null;
  const cards = await getShowcaseCards(userId, sc.pins);
  return { sc, cards };
}
