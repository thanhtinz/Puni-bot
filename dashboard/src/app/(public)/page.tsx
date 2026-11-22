import Link from "next/link";
import { IconDiscord, IconLogin, IconSpark } from "@/components/icons";
import { botInviteUrl } from "@/lib/invite";
import catalog from "@/data/command-catalog.json";
import Reveal from "@/components/reveal";
import PawPrint from "@/components/paw";

const MARQUEE = [
  "mở gói thẻ",
  "pity 30 · 90",
  "bộ bài 30 lá",
  "đấu hạng elo",
  "thách đấu cược coins",
  "chợ thẻ người chơi",
  "tiến hoá thẻ",
  "đốt thẻ lấy mảnh",
  "gói miễn phí mỗi ngày",
  "161.000+ lá thẻ thật",
  "7 bậc độ hiếm",
  "trao đổi thẻ",
];

/** Five chase cards of Romance Dawn (One Piece), fanned in the hero.
 *  Only printings whose official art carries no SAMPLE stamp are used
 *  on public surfaces (owner order 2026-11-22). */
const FAN = [
  { slug: "op01-031", name: "Kouzuki Oden", rot: -16, y: 26, z: 1 },
  { slug: "op01-001", name: "Roronoa Zoro", rot: -8, y: 8, z: 2 },
  { slug: "op01-120", name: "Shanks", rot: 0, y: 0, z: 3 },
  { slug: "op01-121", name: "Yamato", rot: 8, y: 8, z: 2 },
  { slug: "op01-060", name: "Donquixote Doflamingo", rot: 16, y: 26, z: 1 },
];

const RARITIES = [
  { name: "Common", rate: 55, color: "#9fb3c8", slug: "op01-009", label: "Carrot" },
  { name: "Uncommon", rate: 25, color: "#7fd08c", slug: "op01-011", label: "Gordon" },
  { name: "Rare", rate: 12, color: "#6fb7ff", slug: "op01-004", label: "Usopp" },
  { name: "Epic", rate: 5, color: "#c792ff", slug: "op01-078", label: "Boa Hancock" },
  { name: "Legendary", rate: 2, color: "#ffd83d", slug: "op01-120", label: "Shanks" },
  { name: "Mythical", rate: 0.7, color: "#ff9de2", slug: "op01-001", label: "Roronoa Zoro" },
  { name: "Fabled", rate: 0.3, color: "#ff7a59", slug: null, label: "Có ở họ thẻ khác" },
];

const SHOWCASE = [
  { slug: "op01-120", name: "Shanks", rarity: "Legendary" },
  { slug: "op01-121", name: "Yamato", rarity: "Legendary" },
  { slug: "op01-031", name: "Kouzuki Oden", rarity: "Mythical" },
  { slug: "op01-060", name: "Donquixote Doflamingo", rarity: "Mythical" },
  { slug: "op01-001", name: "Roronoa Zoro", rarity: "Mythical" },
  { slug: "op01-078", name: "Boa Hancock", rarity: "Epic" },
  { slug: "op01-013", name: "Sanji", rarity: "Rare" },
  { slug: "op01-077", name: "Perona", rarity: "Uncommon" },
];

const LOOP = [
  {
    step: "1",
    title: "Mở gói thẻ",
    text: "Mỗi ngày một gói miễn phí, mở thêm bằng Coins. Pity bảo hiểm: 30 lượt chắc chắn có Epic, 90 lượt chắc chắn có Legendary trở lên — không bao giờ tay trắng quá lâu.",
  },
  {
    step: "2",
    title: "Xây bộ bài 30 lá",
    text: "Tối đa 3 bản mỗi loài, ít nhất 10 loài khác nhau. Nâng cấp thẻ bằng Mảnh, cường hoá +10, tiến hoá lên dạng mạnh hơn — bộ bài là dấu ấn của riêng bạn.",
  },
  {
    step: "3",
    title: "Đấu thẻ",
    text: "Đấu thường với bot, đấu hạng Elo theo mùa leo từ Đồng tới Cao Thủ, hoặc thách đấu cược Coins trực tiếp với bạn bè — thắng bại tính bằng bộ bài bạn xây.",
  },
  {
    step: "4",
    title: "Chợ & trao đổi",
    text: "Đăng bán thẻ thừa trên chợ người chơi, săn lá còn thiếu trong Sổ Dex, hoặc trao đổi trực tiếp với người chơi khác — giá do cộng đồng quyết định.",
  },
];

const RANKS = ["Đồng", "Bạc", "Vàng", "Bạch Kim", "Kim Cương", "Cao Thủ"];

function CardFan() {
  return (
    <div className="fan-stage" aria-hidden="true">
      <div className="mock-glow" />
      {FAN.map((c) => (
        <img
          key={c.slug}
          src={`/op/${c.slug}.jpg`}
          alt=""
          className="fan-card"
          style={{
            transform: `translateY(${c.y}px) rotate(${c.rot}deg)`,
            zIndex: c.z,
          }}
        />
      ))}
      <span className="sticker" style={{ top: 2, right: 10, transform: "rotate(5deg)", zIndex: 5 }}>
        shanks · yamato — legendary
      </span>
      <span className="sticker pink" style={{ bottom: 6, left: 4, transform: "rotate(-5deg)", zIndex: 5 }}>
        pity 90 bảo hiểm
      </span>
    </div>
  );
}

export default function HomePage() {
  const inviteUrl = botInviteUrl();
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
        <div className="wrap hero-grid">
          <div>
            <h1>
              <span className="h1-line">Sưu tầm thẻ.</span>{" "}
              <span className="hl h1-line">Xây bộ bài. Leo hạng</span>{" "}
              <span className="h1-line">ngay trong Discord</span>
            </h1>
            <p className="sub">
              Puni là game thẻ bài TCG chạy ngay trong Discord: mở gói săn thẻ hiếm,
              xây bộ bài 30 lá theo chiến thuật của bạn, đấu hạng Elo theo mùa và mua
              bán trên chợ người chơi — mọi lá thẻ đều là của bạn, đi theo tài khoản
              Discord qua mọi server.
            </p>
            <div className="hero-cta">
              {inviteUrl ? (
                <a href={inviteUrl} target="_blank" rel="noreferrer" className="btn secondary">
                  <IconDiscord size={18} />
                  Mời bot về server
                </a>
              ) : null}
              <Link href="/commands" className="btn ghost">
                Xem danh sách lệnh
              </Link>
            </div>
            <p className="hero-note">Miễn phí chơi · Mỗi ngày một gói thẻ miễn phí · {publicCount}+ lệnh game</p>
          </div>
          <CardFan />
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
          <div className="eyebrow">19 họ thẻ · 2.268 bộ thẻ</div>
          <h2>161.198 lá thẻ thật, 7 bậc độ hiếm</h2>
          <p className="lead">
            Mỗi lá là một lá TCG có thật — One Piece, Pokémon, Magic, Yu-Gi-Oh! và
            15 họ thẻ nữa — với giá thị trường thật làm nền giá trị trong game.
            Tỉ lệ mở gói minh bạch, có pity bảo hiểm theo từng banner.
          </p>
          <Reveal>
          <div className="rarity-list">
            {RARITIES.map((r) => (
              <div className="rarity-row" key={r.name}>
                {r.slug ? (
                  <img src={`/op/${r.slug}.jpg`} alt={r.label} className="rarity-thumb" loading="lazy" />
                ) : (
                  <span className="rarity-thumb rarity-thumb-empty">?</span>
                )}
                <span className="rarity-name" style={{ color: r.color }}>{r.name}</span>
                <span className="rarity-bar">
                  <span className="rarity-fill" style={{ width: `${Math.max(3, r.rate)}%`, background: r.color }} />
                </span>
                <span className="rarity-rate">{r.rate}%</span>
                <span className="rarity-sample">{r.label}</span>
              </div>
            ))}
          </div>
          </Reveal>
          <Reveal delay={100}>
          <div className="stat-grid">
            <div className="stat-card">
              <div className="num">161.198</div>
              <div className="cap">Lá thẻ trong kho dữ liệu</div>
              <p>19 họ thẻ TCG thật — Sổ Dex ghi lại từng lá bạn đã sở hữu.</p>
            </div>
            <div className="stat-card">
              <div className="num">90</div>
              <div className="cap">Pity bảo hiểm Legendary</div>
              <p>Đủ 90 lượt mở chưa ra Legendary thì lượt 90 chắc chắn ra — đếm riêng từng banner.</p>
            </div>
            <div className="stat-card">
              <div className="num">30</div>
              <div className="cap">Lá mỗi bộ bài</div>
              <p>Tối đa 5 bộ bài lưu sẵn, chuyển qua lại tuỳ đối thủ và chiến thuật.</p>
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
            <div className="eyebrow">vòng chơi</div>
            <h2>Từ gói thẻ tới ngôi vương</h2>
          </div>
          <Reveal delay={120}>
          <div className="feat-grid loop-grid">
            {LOOP.map((s) => (
              <div className="feat-card" key={s.step}>
                <div className="feat-ico loop-step">{s.step}</div>
                <h3>{s.title}</h3>
                <p>{s.text}</p>
              </div>
            ))}
          </div>
          </Reveal>
          <Reveal delay={160}>
          <div className="rank-strip">
            <span className="rank-strip-label"><IconSpark size={16} /> Đấu hạng theo mùa:</span>
            {RANKS.map((r, i) => (
              <span key={r} className="rank-chip" style={{ opacity: 0.55 + i * 0.09 }}>{r}</span>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <div className="eyebrow">phòng trưng bày</div>
          <h2>Những lá thẻ đáng săn nhất</h2>
          <p className="lead">
            Shanks, Yamato, Kaido và những lá được săn nhất của bộ Romance Dawn —
            mở gói, mua trên chợ hoặc trao đổi với người chơi khác để đưa chúng về
            kho của bạn.
          </p>
          <Reveal>
          <div className="showcase-grid">
            {SHOWCASE.map((c) => (
              <figure className="showcase-tile" key={c.slug}>
                <img src={`/op/${c.slug}.jpg`} alt={`Thẻ ${c.name}`} loading="lazy" />
                <figcaption>
                  <b>{c.name}</b>
                  <span className={`rarity-tag rarity-${c.rarity.toLowerCase()}`}>{c.rarity}</span>
                </figcaption>
              </figure>
            ))}
          </div>
          </Reveal>
        </div>
      </section>

      <section className="section extras-strip">
        <div className="wrap">
          <p>
            Bên cạnh thẻ bài, Puni còn có ví Coins dùng chung mọi server, hệ thống kết
            hôn với nhẫn 7 bậc, minigame blackjack · tung xu · cờ caro · đua thú, kênh
            đếm số &amp; nối chữ, 69 lệnh tương tác và AI trò chuyện — xem tất cả ở{" "}
            <Link href="/commands">danh sách lệnh</Link>.
          </p>
        </div>
      </section>

      <section className="section">
        <div className="wrap">
          <Reveal>
          <div className="cta">
            <h2>Gói thẻ đầu tiên đang chờ</h2>
            <p>
              Đăng nhập bằng Discord để vào khu người chơi: mở gói miễn phí, xem kho
              thẻ, xây bộ bài đầu tiên và leo hạng ngay hôm nay.
            </p>
            <Link href="/api/auth/login" className="btn">
              <IconLogin size={18} />
              Vào khu người chơi
            </Link>
            {inviteUrl ? (
              <a href={inviteUrl} target="_blank" rel="noreferrer" className="btn ghost" style={{ marginLeft: 10 }}>
                <IconDiscord size={18} />
                Mời bot về server
              </a>
            ) : null}
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
