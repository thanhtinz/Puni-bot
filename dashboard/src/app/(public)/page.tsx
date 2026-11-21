import Link from "next/link";
import catalog from "@/data/command-catalog.json";

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
          <div className="mock-ava">P</div>
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
      <div className="mock-mini">
        <b>puni:</b> mình là Puni, người bạn nhỏ của server này — cần gì cứ gọi mình nhé!
      </div>
    </div>
  );
}

export default function HomePage() {
  const publicCount = (catalog as unknown[]).length;
  return (
    <>
      <section className="hero">
        <div className="wrap hero-grid">
          <div>
            <h1>
              tạo nên server <span className="hl">hoàn hảo</span> cùng puni
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
          <h2>một bot, lo trọn server</h2>
          <p className="lead">
            Thay vì cài năm bảy bot rời rạc, Puni gom mọi việc của một server cộng đồng vào
            một chỗ — và mọi cấu hình đều chỉnh được ở cả Discord lẫn dashboard web.
          </p>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="num">{publicCount}+</div>
              <div className="cap">lệnh công khai</div>
              <p>Slash và tiền tố dùng chung một hệ lệnh — danh sách luôn cập nhật tự động từ chính bot.</p>
            </div>
            <div className="stat-card">
              <div className="num">69</div>
              <div className="cap">reaction GIF</div>
              <p>Ôm, vỗ về, trêu chọc… mỗi reaction là một lệnh riêng có câu thoại tiếng Việt.</p>
            </div>
            <div className="stat-card">
              <div className="num">5</div>
              <div className="cap">nhóm log sự kiện</div>
              <p>Tin nhắn, thành viên, server, kiểm duyệt và kênh — bật tắt từng nhóm theo ý bạn.</p>
            </div>
            <div className="stat-card">
              <div className="num">100%</div>
              <div className="cap">miễn phí cộng đồng</div>
              <p>Không bật Shop vẫn dùng đầy đủ tính năng cộng đồng — bot là của server bạn.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="center">
            <div className="eyebrow">làm cho server là của bạn</div>
            <h2>tuỳ biến theo cách của bạn</h2>
          </div>
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
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="cta">
            <h2>bắt đầu hôm nay, miễn phí</h2>
            <p>
              Thêm Puni vào server và cấu hình từng bước ngay trong dashboard — chào mừng,
              log và automod xong trong vài phút.
            </p>
            <Link href="/api/auth/login" className="btn">
              Bắt đầu ngay
            </Link>
            <div className="cta-mascot">P</div>
          </div>
        </div>
      </section>
    </>
  );
}
