import Link from "next/link";
import catalog from "@/data/command-catalog.json";
import Reveal from "@/components/reveal";
import PawPrint from "@/components/paw";

const MARQUEE = [
  "chào mừng",
  "log 5 nhóm",
  "automod",
  "69 reaction",
  "coinflip",
  "blackjack",
  "đua thú",
  "nối số · nối chữ",
  "ma sói",
  "cozy world",
  "hunt & battle",
  "quest mỗi ngày",
  "kết hôn",
  "bảng xếp hạng",
];

function DiscordMockup() {
  return (
    <div className="mock-stage">
      <div className="mock-glow" />
      <div className="mock-card">
        <span className="mock-badge">mới vào server</span>
        <div className="mock-msg">
          <img src="/logo.jpg" alt="Puni" className="mock-ava-img" />
          <div>
            <div className="mock-name">
              Puni <span className="app-tag">APP</span> <span className="mock-time">hôm nay lúc 21:51</span>
            </div>
            <div className="mock-text">Chào mừng @thanhvienmoi đến với server!</div>
            <div className="mock-embed">
              <div className="t">Bạn là thành viên thứ 1.024</div>
              <div className="d">
                Ghé kênh giới thiệu chào mọi người, nhận daily đầu tiên bằng lệnh /eco và
                xem danh sách lệnh bằng !help nhé.
              </div>
            </div>
            <span className="mock-react">
              <span>★</span> 12
            </span>
          </div>
        </div>
      </div>
      <span className="sticker" style={{ top: -8, right: 6, transform: "rotate(5deg)", zIndex: 3 }}>dễ thương quá đi</span>
      <div className="mock-mini">
        <b>puni:</b> Mình là Puni, người bạn nhỏ của server này — cần gì cứ gọi mình nhé!
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
              Tạo nên server <span className="hl">hoàn hảo</span> cùng Puni
            </h1>
            <p className="sub">
              Puni là bot cộng đồng Discord tất cả trong một: chào mừng, ghi log, kiểm duyệt
              tự động, reaction vui nhộn, minigame và cả một thế giới game Cozy World — để
              server của bạn vận hành gọn gàng mà vẫn đầy sức sống.
            </p>
            <div className="hero-cta">
              <Link href="/api/auth/login" className="btn">
                Thêm vào Discord
              </Link>
              <Link href="/dashboard" className="btn ghost">
                Mở Dashboard
              </Link>
            </div>
            <p className="hero-note">Miễn phí cho server cộng đồng · Cấu hình ngay trong Discord hoặc trên web</p>
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
          <h2>Một bot, lo trọn server</h2>
          <p className="lead">
            Thay vì cài năm bảy bot rời rạc, Puni gom mọi việc của một server cộng đồng vào
            một chỗ — và mọi cấu hình đều chỉnh được ở cả Discord lẫn dashboard web.
          </p>
          <Reveal>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="num">{publicCount}+</div>
              <div className="cap">Lệnh công khai</div>
              <p>Slash và tiền tố dùng chung một hệ lệnh — danh sách luôn cập nhật tự động từ chính bot.</p>
            </div>
            <div className="stat-card">
              <div className="num">69</div>
              <div className="cap">Reaction GIF</div>
              <p>Ôm, vỗ về, trêu chọc… mỗi reaction là một lệnh riêng có câu thoại tiếng Việt.</p>
            </div>
            <div className="stat-card">
              <div className="num">5</div>
              <div className="cap">Nhóm log sự kiện</div>
              <p>Tin nhắn, thành viên, server, kiểm duyệt và kênh — bật tắt từng nhóm theo ý bạn.</p>
            </div>
            <div className="stat-card">
              <div className="num">100%</div>
              <div className="cap">Miễn phí cộng đồng</div>
              <p>Toàn bộ tính năng cộng đồng đều miễn phí — Puni là bạn của server bạn.</p>
            </div>
          </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="center">
            <div className="eyebrow">làm cho server là của bạn</div>
            <h2>Tuỳ biến theo cách của bạn</h2>
          </div>
          <Reveal delay={120}>
          <div className="feat-grid">
            <div className="feat-card">
              <div className="feat-ico">Aa</div>
              <h3>Tạo mọi thứ bằng embed</h3>
              <p>
                Dựng tin nhắn embed có nút bấm ngay trên dashboard bằng trình tạo trực quan —
                thông báo, luật server, menu chọn vai trò đều đẹp và gọn.
              </p>
            </div>
            <div className="feat-card">
              <div className="feat-ico">P!</div>
              <h3>Prefix &amp; phong cách riêng</h3>
              <p>
                Đổi tiền tố lệnh theo từng server, tự viết lời chào mừng / tạm biệt / cảm ơn
                boost bằng các biến {"{user}"}, {"{server}"}, {"{count}"}.
              </p>
            </div>
            <div className="feat-card">
              <div className="feat-ico">24/7</div>
              <h3>Ổn định bạn tin được</h3>
              <p>
                Kiến trúc shard + cluster, trạng thái từng shard hiện công khai theo thời gian
                thực ở trang Trạng thái — bot sống hay chết, bạn nhìn là biết.
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
            <h2>Bắt đầu hôm nay, miễn phí</h2>
            <p>
              Thêm Puni vào server và cấu hình từng bước ngay trong dashboard — chào mừng,
              log và automod xong trong vài phút.
            </p>
            <Link href="/api/auth/login" className="btn">
              Bắt đầu ngay
            </Link>
            <span className="cta-paws" aria-hidden="true">
              <PawPrint size={30} rotate={-14} />
              <PawPrint size={24} rotate={16} style={{ marginTop: 14 }} />
              <PawPrint size={28} rotate={-8} />
            </span>
            <img src="/logo.jpg" alt="Mascot Puni" className="cta-logo" />
          </div>
          </Reveal>
        </div>
      </section>
    </>
  );
}
