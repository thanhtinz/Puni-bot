import Link from "next/link";
import { getBotConfig, getSiteSetting } from "@/lib/db";
import { normalizeMembershipTiers } from "@/lib/membership";
import { IconSpark } from "@/components/icons";
import { getPaymentSettings } from "@/lib/payment";
import BuyBox from "./buy-box";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Hội viên Puni — ủng hộ và nhận quyền lợi",
  description:
    "Các gói hội viên của Puni: daily nhận thêm tiền, thêm đội hình và lootbox trong game, pet độc quyền và huy hiệu riêng.",
};

/** Public membership page (spec 6.19). Tiers come from the owner-edited
 *  config — nothing about names/prices/perks is hardcoded here. */
export default async function MembershipPage() {
  const tiers = normalizeMembershipTiers(
    await getBotConfig("membership_tiers").catch(() => null),
  );
  const joinUrl = await getSiteSetting("membership_url").catch(() => null);
  const supportUrl = await getSiteSetting("support_url").catch(() => null);
  const payment = await getPaymentSettings().catch(() => null);

  return (
    <div className="wrap pub-main">
      <section className="page-head">
        <span className="eyebrow">
          <IconSpark size={15} /> Hội viên Puni
        </span>
        <h1>Ủng hộ Puni, nhận quyền lợi thật</h1>
        <p>
          Hội viên là cách bạn giúp Puni có kinh phí chạy máy chủ và phát triển
          tiếp. Đổi lại, bạn nhận thêm tiền daily mỗi ngày cùng các quyền lợi
          trong game — quyền lợi cộng dồn: gói cao gồm mọi quyền
          lợi của gói dưới.
        </p>
      </section>

      {tiers.length === 0 ? (
        <p className="empty-note">Hiện chưa có gói hội viên nào đang mở.</p>
      ) : (
        <section className="tier-grid">
          {tiers.map((t, i) => (
            <article className={`tier-card${i === tiers.length - 1 ? " tier-top" : ""}`} key={t.id}>
              <h2>{t.name}</h2>
              {t.priceLabel ? <div className="tier-price">{t.priceLabel}</div> : null}
              <ul>
                {t.perks.map((perk) => (
                  <li key={perk}>{perk}</li>
                ))}
              </ul>
              {payment && t.priceAmount > 0 ? (
                <a className="btn" href="#mua-goi">
                  Mua gói này
                </a>
              ) : joinUrl ? (
                <a className="btn" href={joinUrl} target="_blank" rel="noreferrer">
                  Đăng ký gói này
                </a>
              ) : supportUrl ? (
                <a className="btn" href={supportUrl} target="_blank" rel="noreferrer">
                  Liên hệ để đăng ký
                </a>
              ) : (
                <span className="tier-note">Dùng lệnh /pass trong Discord để xem gói của bạn</span>
              )}
            </article>
          ))}
        </section>
      )}

      {payment ? <BuyBox tiers={tiers} /> : null}

      <section className="page-note">
        <p>
          Sau khi đăng ký, gói được kích hoạt theo Discord ID của bạn và áp
          dụng ở mọi server có Puni. Kiểm tra bất cứ lúc nào bằng lệnh{" "}
          <code>/pass</code> trong Discord. Cần hỗ trợ thêm?{" "}
          <Link href="/commands">Xem danh sách lệnh</Link> hoặc vào kênh Support
          trên menu.
        </p>
      </section>
    </div>
  );
}
