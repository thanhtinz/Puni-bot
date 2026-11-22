import { currentSession } from "@/lib/current-session";
import { getBotConfig, getSiteSetting, getUserMembership, listUserOrders } from "@/lib/db";
import { normalizeMembershipTiers } from "@/lib/membership";
import { getPaymentSettings } from "@/lib/payment";
import BuyBox from "@/components/membership-buy-box";

export const dynamic = "force-dynamic";

const fmtVnd = (n: number) => n.toLocaleString("vi-VN") + "đ";
const ORDER_LABEL: Record<string, string> = {
  pending: "Đang chờ thanh toán",
  paid: "Đã thanh toán",
  cancelled: "Đã huỷ",
};

/**
 * Membership inside the player area (owner ruling 2026-11-21:
 * buying membership lives with the player pages, not on the public
 * site). The signed-in user buys for their own account — no Discord
 * ID typing. Tiers/prices/perks come from the owner-edited config.
 */
export default async function MeMembershipPage() {
  const session = (await currentSession())!;
  const [tiers, mine, orders, payment, joinUrl] = await Promise.all([
    getBotConfig("membership_tiers").then(normalizeMembershipTiers).catch(() => normalizeMembershipTiers(null)),
    getUserMembership(session.userId).catch(() => null),
    listUserOrders(session.userId),
    getPaymentSettings().catch(() => null),
    getSiteSetting("membership_url").catch(() => null),
  ]);
  const myTier = mine?.active ? tiers.find((t) => t.id === mine.tier_id) : null;

  return (
    <div className="player-body-inner">
      <h1>Hội viên Puni</h1>
      <p className="player-sub">
        Hội viên giúp Puni có kinh phí chạy máy chủ và phát triển tiếp. Quyền lợi cộng dồn:
        gói cao gồm mọi quyền lợi của gói dưới, áp dụng ở mọi server có Puni.
      </p>

      <section className="player-panel">
        <h2>Gói của tôi</h2>
        {mine?.active ? (
          <p>
            Bạn đang là hội viên gói <strong>{myTier?.name ?? mine.tier_id}</strong>
            {myTier && myTier.dailyBonusPercent > 0 ? <> — daily nhận thêm {myTier.dailyBonusPercent}%</> : null},
            còn hạn tới{" "}
            <strong>{new Date(mine.expires_at).toLocaleDateString("vi-VN")}</strong>.
            Mua thêm gói bất kỳ sẽ cộng dồn thêm 30 ngày.
          </p>
        ) : (
          <p>Bạn chưa có gói hội viên đang hoạt động. Chọn một gói bên dưới để bắt đầu.</p>
        )}
      </section>

      {tiers.length === 0 ? (
        <p className="player-notice">Hiện chưa có gói hội viên nào đang mở.</p>
      ) : (
        <div className="tier-grid player-tiers">
          {tiers.map((t, i) => (
            <article className={`tier-card light${i === tiers.length - 1 ? " tier-top" : ""}`} key={t.id}>
              <h2>{t.name}</h2>
              {t.priceLabel ? <div className="tier-price">{t.priceLabel}</div> : null}
              <ul>
                {t.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              {payment && t.priceAmount > 0 ? (
                <a className="btn" href="#mua-goi">Mua gói này — {fmtVnd(t.priceAmount)}/30 ngày</a>
              ) : joinUrl ? (
                <a className="btn" href={joinUrl} target="_blank" rel="noreferrer">Đăng ký gói này</a>
              ) : (
                <span className="tier-note">Dùng lệnh /pass trong Discord để xem gói của bạn</span>
              )}
            </article>
          ))}
        </div>
      )}

      {payment ? (
        <div className="player-buywrap">
          <BuyBox tiers={tiers} fixedUserId={session.userId} />
        </div>
      ) : (
        <p className="player-notice">
          Kênh mua trực tuyến đang tạm đóng — bạn vẫn xem và dùng gói bằng lệnh /pass trong Discord.
        </p>
      )}

      <section className="player-panel">
        <h2>Đơn hàng của tôi</h2>
        {orders.length ? (
          <div>
            {orders.map((o) => {
              const expired = o.status === "pending" && Date.now() - new Date(o.created_at).getTime() > 24 * 3600 * 1000;
              return (
                <div className="player-line" key={o.code}>
                  <span>
                    <code>{o.code}</code> · {o.tier_name} · {fmtVnd(o.amount)} · {o.days} ngày ·{" "}
                    {new Date(o.created_at).toLocaleString("vi-VN")}
                  </span>
                  <span className="tcg-badge">{expired ? "Đã hết hạn" : ORDER_LABEL[o.status] ?? o.status}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="player-sub">Bạn chưa có đơn hội viên nào.</p>
        )}
      </section>
    </div>
  );
}
