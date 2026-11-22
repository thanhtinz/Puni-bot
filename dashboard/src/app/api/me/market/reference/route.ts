import { NextResponse } from "next/server";
import { currentSession } from "@/lib/current-session";
import { db } from "@/lib/db";
import { getPriceCoinsPerUsd, resolveReference } from "@/lib/tcg";
import { sellerFeePercent } from "@/lib/player";

/**
 * Reference price lookup for the market sell box (spec 6.29): given an
 * instance code the caller owns, return the species' resolved
 * reference value (internal market price → imported price → rarity
 * table), a suggested integer listing price and the caller's actual
 * sale fee — so sellers price with real market data, not guesses.
 */
export async function GET(req: Request) {
  const session = await currentSession();
  if (!session) return NextResponse.json({ error: "Chưa đăng nhập." }, { status: 401 });
  const code = (new URL(req.url).searchParams.get("code") ?? "").toUpperCase().trim();
  if (!/^[A-Z0-9]{8}$/.test(code)) {
    return NextResponse.json({ error: "Mã thẻ phải gồm đúng 8 ký tự." }, { status: 400 });
  }
  const res = await db().query(
    `SELECT i.level, i.enhance, s.name, s.rarity, s.sprite_url,
            s.price_usd::text AS price_usd, s.market_price_coins::text AS market_price_coins,
            s.market_sales
     FROM tcg_instances i LEFT JOIN game_species s ON s.id = i.species_id
     WHERE i.code = $1 AND i.user_id = $2`,
    [code, session.userId],
  );
  const r = res.rows[0];
  if (!r) return NextResponse.json({ error: "Không tìm thấy thẻ này trong kho của bạn." }, { status: 404 });
  const rate = await getPriceCoinsPerUsd();
  const priceUsd = r.price_usd != null ? Number.parseFloat(r.price_usd) : null;
  const marketPrice = r.market_price_coins != null ? Number.parseFloat(r.market_price_coins) : null;
  const reference = resolveReference(r.rarity ?? "Common", priceUsd, marketPrice, rate);
  // Instance value includes the level/enhance growth, like cardValue.
  const instanceValue = reference * (1 + Math.max(0, r.level - 1) * 0.02 + Math.max(0, r.enhance) * 0.15);
  const feePercent = await sellerFeePercent(session.userId);
  return NextResponse.json({
    name: r.name ?? code,
    rarity: r.rarity ?? "Common",
    spriteUrl: r.sprite_url ?? "",
    level: r.level,
    enhance: r.enhance,
    reference,
    instanceValue: Math.round(instanceValue * 10000) / 10000,
    suggested: Math.max(10, Math.round(instanceValue)),
    feePercent,
    marketSales: r.market_sales ?? 0,
    hasInternalPrice: marketPrice != null,
  });
}
