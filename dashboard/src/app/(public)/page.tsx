import Link from "next/link";
import { IconCoins, IconHeart, IconSpark } from "@/components/icons";
import catalog from "@/data/command-catalog.json";
import Reveal from "@/components/reveal";
import PawPrint from "@/components/paw";

const MARQUEE = [
  "mở gói thẻ",
  "pity 30 · 90",
  "bộ bài 30 lá",
  "đấu hạng elo",
  "thách đấu cược coins",
  "chợ thẻ",
  "trao đổi thẻ",
  "daily mỗi ngày",
  "kết hôn",
  "nhẫn 7 bậc",
  "đốt thẻ lấy mảnh",
  "tiến hoá thẻ",
  "hội viên",
  "bảng xếp hạng",
];

function DiscordMockup() {
  return (
    <div className="mock-stage">
      <div className="mock-glow" />
      <div className="mock-card">
        <span className="mock-badge">mở gói thẻ</span>
        <div className="mock-msg">
          <img src="/api/assets/logo" alt="Puni" className="mock-ava-img" />
          <div>
            <div className="mock-name">
              Puni <span className="app-tag">APP</span> <span className="mock-time">hôm nay lúc 21:51</span>
            </div>
            <div className="mock-text">@nguoichoi mở 10 gói Bộ Tuxemon và nhận được:</div>
            <div className="mock-embed">
              <div className="t">Rockitten · Licc · Aardart · … · Flammie (Epic!)</div>
              <div className="d">
                Pity đang ở 24/90 — chắc chắn có thẻ Legendary trở lên ở lượt 90. Gõ
                !collection để xem kho thẻ, !deck để xây bộ bài đấu hạng nhé.
              </div>
            </div>
            <span className="mock-react">
              <PawPrint size={13} /> 12
            </span>
          </div>
        </div>
      </div>
      <span className="sticker" style={{ top: -8, right: 6, transform: "rotate(5deg)", zIndex: 3 }}>hên quá đi</span>
      <div className="mock-mini">
        <b>puni:</b> Hôm nay bạn và người ấy đã nhận daily chưa? Cả hai cùng nhận là có quà
        TCG cho cặp đôi đó!
      </div>
    </div>
  );
}

export default function HomePage() {
  const publicCount = (catalog as unknown[]).length;
  return (
    <>
      <section className="hero">
        <span className="sparkle" style={{ top: 118, left: "6%" }}>
          <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z" /></svg>
        </span>
        <span className="sparkle" style={{ top: 210, left: "44%", animationDelay: "0.9s", color: "#ffb3c7" }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z" /></svg>
        </span>
        <span className="paw-deco" style={{ top: 150, left: "2.5%" }}>
          <PawPrint size={40} rotate={-18} />
        </span>
        <span className="paw-deco" style={{ bottom: 120, left: "47%", animationDelay: "1.3s" }}>
          <PawPrint size={30} rotate={24} />
        </span>
        <span className="paw-deco" style={{ top: 128, right: "3%", animationDelay: "2.1s", color: "#ffb3c7" }}>
          <PawPrint size={36} rotate={14} />
        </span>
        <span className="sparkle" style={{ top: 96, right: "10%", animationDelay: "1.7s" }}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="currentColor"><path d="M12 1 L14.6 9.4 L23 12 L14.6 14.6 L12 23 L9.4 14.6 L1 12 L9.4 9.4 Z" /></svg>
        </span>
        <div className="wrap hero-grid">
          <div>
            <h1>
              Game thẻ bài <span className="hl">TCG</span> ngay trong Discord
            </h1>
            <p className="sub">
              Puni là bot game thuần thẻ bài: mở gói sưu tầm hàng trăm lá thẻ, xây bộ bài
              30 lá, đấu hạng leo bậc, mua bán trên chợ người chơi — cùng một ví Coins
              dùng chung mọi server và cả hệ thống kết hôn dễ thương.
            </p>
            <div className="hero-cta">
              <Link href="/api/auth/login" className="btn">
                Chơi ngay bằng Discord
              </Link>
              <Link href="/commands" className="btn ghost">
                Xem danh sách lệnh
              </Link>
            </div>
            <p className="hero-note">Miễn phí chơi · Đăng nhập là vào thẳng khu người chơi của bạn</p>
          <div className="paw-trail" style={{ marginTop: 26 }} aria-hidden="true">
            <span className="step" style={{ animationDelay: "0s" }}><PawPrint size={22} rotate={-16} /></span>
            <span className="step" style={{ animationDelay: "0.4s", transform: "translateY(7px)" }}><PawPrint size={22} rotate={12} /></span>
            <span className="step" style={{ animationDelay: "0.8s" }}><PawPrint size={22} rotate={-16} /></span>
            <span className="step" style={{ animationDelay: "1.2s", transform: "translateY(7px)" }}><PawPrint size={22} rotate={12} /></span>
            <span className="step" style={{ animationDelay: "1.6s" }}><PawPrint size={22} rotate={-16} /></span>
            <span className="step" style={{ animationDelay: "2s", transform: "translateY(7px)" }}><PawPrint size={22} rotate={12} /></span>
          </div>
          </div>
          <DiscordMockup />
        </div>
      </section>

      <div className="marquee" aria-hidden="true">
        <div className="marquee-track">
          {[...MARQUEE, ...MARQUEE].map((m, i) => (
            <span className="chip" key={i}>
              <i>{i % 2 === 0 ? "✦" : "♥"}</i>
              {m}
            </span>
          ))}
        </div>
      </div>

      <section className="section">
        <div className="wrap">
          <div className="eyebrow">vì sao chọn puni?</div>
          <h2>Một ví, một kho thẻ, mọi server</h2>
          <p className="lead">
            Thẻ, Coins và hôn nhân của bạn đi theo tài khoản Discord — chơi ở server nào
            cũng là cùng một bộ sưu tập, cùng một số dư, cùng một người ấy.
          </p>
          <Reveal>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="num">{publicCount}+</div>
              <div className="cap">Lệnh chơi game</div>
              <p>Slash và tiền tố dùng chung một hệ lệnh — danh sách luôn cập nhật tự động từ chính bot.</p>
            </div>
            <div className="stat-card">
              <div className="num">411</div>
              <div className="cap">Thẻ bộ Tuxemon</div>
              <p>Bộ thẻ đầu tiên với 411 loài và nhiều bộ thẻ mới đang được phát triển thêm.</p>
            </div>
            <div className="stat-card">
              <div className="num">7</div>
              <div className="cap">Bậc nhẫn cưới</div>
              <p>Từ Nhẫn Vàng Trơn tới Nhẫn Kim Cương — nhẫn đắt chỉ để thể diện, quyền lợi như nhau.</p>
            </div>
            <div className="stat-card">
              <div className="num">100%</div>
              <div className="cap">Miễn phí chơi</div>
              <p>Toàn bộ game đều miễn phí — Puni là bạn của mọi người chơi.</p>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="center">
            <div className="eyebrow">ba trụ cột của puni</div>
            <h2>Thẻ bài · Economy · Hôn nhân</h2>
          </div>
          <Reveal delay={120}>
          <div className="feat-grid">
            <div className="feat-card">
              <div className="feat-ico"><IconSpark size={22} /></div>
              <h3>Game thẻ bài TCG</h3>
              <p>
                Mở gói có pity bảo hiểm 30/90, nâng cấp và tiến hoá thẻ, xây bộ bài 30 lá,
                đấu thường, đấu hạng Elo theo mùa và thách đấu cược Coins với bạn bè.
              </p>
            </div>
            <div className="feat-card">
              <div className="feat-ico"><IconCoins size={22} /></div>
              <h3>Economy toàn hệ thống</h3>
              <p>
                Coins dùng chung mọi server: nhận daily giữ chuỗi ngày, chuyển tiền cho
                nhau, leo bảng xếp hạng tài sản và tiêu Coins ngay trong game thẻ.
              </p>
            </div>
            <div className="feat-card">
              <div className="feat-ico"><IconHeart size={22} /></div>
              <h3>Kết hôn &amp; quà cặp đôi</h3>
              <p>
                Mua nhẫn, cầu hôn, nâng cấp nhẫn cho người ấy — và khi cả hai cùng nhận
                daily trong ngày, mỗi người nhận thêm một món quà TCG.
              </p>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal>
          <div className="cta">
            <h2>Bắt đầu sưu tầm hôm nay</h2>
            <p>
              Đăng nhập bằng Discord để vào khu người chơi: xem kho thẻ, bộ bài, chợ thẻ
              và hồ sơ của bạn — gói thẻ miễn phí đầu tiên đang chờ.
            </p>
            <Link href="/api/auth/login" className="btn">
              Vào khu người chơi
            </Link>
            <span className="cta-paws" aria-hidden="true">
              <PawPrint size={30} rotate={-14} />
              <PawPrint size={24} rotate={16} style={{ marginTop: 14 }} />
              <PawPrint size={28} rotate={-8} />
            </span>
            <img src="/api/assets/logo" alt="Mascot Puni" className="cta-logo" />
          </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
