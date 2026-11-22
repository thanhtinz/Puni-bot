import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { userWallet, speciesDisplay, RARITY_VI } from "@/lib/tcg";
import {
  listActiveBannersWeb, getPityWeb, getTcgConfigWeb, revealInstances, TCG_RARITIES,
} from "@/lib/gacha";
import PackReveal from "@/components/pack-reveal";
import { cardValue, getPriceCoinsPerUsd, getSellRatePercent, snapMoney } from "@/lib/player";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Mở thẻ trên web (spec 6.24): cùng banner, tỉ lệ, pity và giá với
 * lệnh gacha trong Discord — mở ở đâu cũng vào chung một kho thẻ.
 */
export default async function MeGachaPage({
  searchParams,
}: {
  searchParams: Promise<{ msg?: string; err?: string; reveal?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [economy, wallet, banners, cfg] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    userWallet(session.userId),
    listActiveBannersWeb(),
    getTcgConfigWeb(),
  ]);
  const balance = economy?.balance ?? 0;
  const revealCodes = (sp.reveal ?? "").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const reveal = revealCodes.length ? await revealInstances(session.userId, revealCodes) : [];
  const sellRate = await getSellRatePercent();
  const priceRate = await getPriceCoinsPerUsd();
  const standardPity = banners.length ? await getPityWeb(session.userId, "standard") : null;
  const featuredDisplay = await speciesDisplay(banners.flatMap((b) => b.featuredSpecies));

  return (
    <div className="player-body-inner">
      <h1>Mở thẻ</h1>
      {sp.msg ? <p className="player-notice ok">{sp.msg}</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <p className="player-sub">
        Số dư {fmt(balance)} Coins · Gói Thường: {wallet.packsStandard} · Gói Cao Cấp: {wallet.packsPremium}
        {standardPity ? (
          <> · Điểm triệu hồi (banner chuẩn): {standardPity.summonPoints}/{cfg.exchangePoints} · Bảo hiểm: còn tối đa {Math.max(0, cfg.pityLegendary - standardPity.sinceLegendary)} lượt tới Huyền thoại</>
        ) : null}
      </p>

      {reveal.length ? (
        <PackReveal
          cards={reveal.map((r) => ({
            code: r.code,
            speciesId: r.speciesId,
            name: r.name ?? r.speciesId,
            rarity: r.rarity,
            rarityVi: RARITY_VI[r.rarity] ?? r.rarity,
            value: snapMoney((cardValue(r.rarity, 1, 0, r.priceUsd, priceRate, r.marketPriceCoins) * sellRate) / 100),
            spriteUrl: r.spriteUrl ?? "",
            setLabel: r.setName ?? "",
          }))}
        />
      ) : null}

      <section className="gacha-block">
        <h2>Gói miễn phí & gói trong kho</h2>
        <div className="gacha-actions">
          <form method="post" action="/api/me/gacha">
            <input type="hidden" name="kind" value="free" />
            <button type="submit" className="player-btn">Nhận gói miễn phí hôm nay</button>
          </form>
          <form method="post" action="/api/me/gacha">
            <input type="hidden" name="kind" value="pack" />
            <input type="hidden" name="pack" value="standard" />
            <button type="submit" className="player-btn" disabled={wallet.packsStandard <= 0}>
              Mở Gói Thường ({wallet.packsStandard})
            </button>
          </form>
          <form method="post" action="/api/me/gacha">
            <input type="hidden" name="kind" value="pack" />
            <input type="hidden" name="pack" value="premium" />
            <button type="submit" className="player-btn" disabled={wallet.packsPremium <= 0}>
              Mở Gói Cao Cấp ({wallet.packsPremium})
            </button>
          </form>
        </div>
        <p className="player-sub">Mỗi gói có 5 thẻ. Gói Cao Cấp đảm bảo lá cuối ít nhất Sử thi.</p>
      </section>

      <section className="gacha-block">
        <h2>Banner đang mở</h2>
        {banners.length === 0 ? (
          <p className="player-notice">Hiện không có banner nào đang mở.</p>
        ) : (
          <div className="gacha-banners">
            {banners.map((b) => {
              const unit = b.kind === "beginner" ? cfg.beginnerCostCoins : b.costCoins || cfg.pullCostCoins;
              return (
                <article className={`gacha-banner v2${b.imageUrl ? " has-art" : ""}`} key={b.id}>
                  <div className="gb-body">
                    {b.featuredSpecies.length ? <span className="gb-ribbon">RATE-UP</span> : null}
                    <h3>{b.name}</h3>
                    <p className="gb-meta">
                      {fmt(unit)} Coins/lượt
                      {b.endsAt ? ` · Kết thúc ${new Date(b.endsAt).toLocaleDateString("vi-VN")}` : ""}
                    </p>
                    {b.featuredSpecies.length ? (
                      <div className="gb-featured">
                        <span className="gb-thumbs">
                          {b.featuredSpecies.slice(0, 2).map((s) => {
                            const d = featuredDisplay.get(s);
                            return d?.spriteUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img key={s} src={d.spriteUrl} alt={d.name} />
                            ) : null;
                          })}
                        </span>
                        <span className="gb-featured-names">
                          Rate-up: {b.featuredSpecies.map((s) => featuredDisplay.get(s)?.name ?? s).join(", ")}
                        </span>
                      </div>
                    ) : null}
                    <div className="gacha-actions">
                      <form method="post" action="/api/me/gacha">
                        <input type="hidden" name="kind" value="pull" />
                        <input type="hidden" name="banner" value={b.id} />
                        <input type="hidden" name="count" value="1" />
                        <button type="submit" className="player-btn">Mở 1 · {fmt(unit)}</button>
                      </form>
                      <form method="post" action="/api/me/gacha">
                        <input type="hidden" name="kind" value="pull" />
                        <input type="hidden" name="banner" value={b.id} />
                        <input type="hidden" name="count" value="10" />
                        <button type="submit" className="player-btn">Mở 10 · {fmt(unit * 10)}</button>
                      </form>
                    </div>
                    <p className="gb-note">Mở 10 đảm bảo ít nhất 1 thẻ Hiếm.</p>
                  </div>
                  {b.imageUrl ? (
                    <div className="gb-art">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={b.imageUrl} alt="" />
                    </div>
                  ) : null}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="gacha-block">
        <h2>Tỉ lệ & bảo hiểm</h2>
        <p className="player-sub">
          {TCG_RARITIES.map((r) => `${RARITY_VI[r]} ${cfg.rates[r]}%`).join(" · ")}
        </p>
        <p className="player-sub">
          Bảo hiểm theo từng banner: {cfg.pityEpic} lượt chắc chắn Sử thi trở lên, {cfg.pityLegendary} lượt
          chắc chắn Huyền thoại trở lên. Mỗi lượt mở +1 Điểm triệu hồi, đủ {cfg.exchangePoints} điểm đổi
          1 thẻ tự chọn trong Discord bằng lệnh gacha exchange.
        </p>
      </section>
    </div>
  );
}
