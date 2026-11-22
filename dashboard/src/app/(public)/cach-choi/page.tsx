import Link from "next/link";

export const metadata = {
  title: "Cách chơi — Puni",
  description:
    "Hướng dẫn chơi Puni: mở gói thẻ miễn phí mỗi ngày, xây bộ bài 30 lá, đấu thẻ, leo hạng và mua bán trên chợ người chơi.",
};

const STEPS = [
  {
    title: "Điểm danh & mở gói miễn phí",
    body: "Mỗi ngày dùng !daily để nhận Coins, rồi !gacha free mở 1 gói thẻ miễn phí (hội viên được thêm gói). Đây là cách có thẻ đầu tiên mà không tốn gì.",
  },
  {
    title: "Mở gói săn thẻ hiếm",
    body: "!gacha mở gói thường 500 Coins/lượt, mở x10 chắc chắn có thẻ Rare trở lên. Hệ thống bảo hiểm (pity): 30 lượt chắc chắn Epic+, 90 lượt chắc chắn Legendary+.",
  },
  {
    title: "Xây bộ bài 30 lá",
    body: "Dùng !deck để tạo bộ bài: đúng 30 lá, tối đa 3 bản cho mỗi loài và ít nhất 10 loài khác nhau. Xem bộ sưu tập ở Sổ Dex trong Khu người chơi trên web.",
  },
  {
    title: "Đấu thẻ & leo hạng",
    body: "!cardbattle đấu với đội máy để ăn Coins và XP cho thẻ. !duel @bạn thách đấu cược Coins, !ranked đấu với bộ bài của người chơi khác để leo hạng Elo theo mùa.",
  },
  {
    title: "Chợ, trao đổi & nâng cấp",
    body: "!market mua bán thẻ với người chơi khác, !trade trao đổi trực tiếp. Thẻ trùng đem đốt lấy Mảnh thẻ để nâng cấp, cường hoá và tiến hoá thẻ chính.",
  },
];

const QUICK_COMMANDS: Array<[string, string]> = [
  ["!daily", "Điểm danh nhận Coins mỗi ngày"],
  ["!gacha free", "Mở gói thẻ miễn phí trong ngày"],
  ["!gacha", "Mở gói thẻ (single / multi x10)"],
  ["!deck", "Tạo và quản lý bộ bài 30 lá"],
  ["!cardbattle", "Đấu thẻ với đội máy"],
  ["!duel @bạn", "Thách đấu cược Coins"],
  ["!ranked", "Đấu hạng Elo theo mùa"],
  ["!market", "Chợ thẻ người chơi"],
  ["!trade", "Trao đổi thẻ trực tiếp"],
  ["!balance", "Xem số dư Coins / Gems"],
  ["!vote", "Vote trên top.gg, nhận Coins mỗi 12 giờ"],
  ["!marry", "Kết hôn: mua nhẫn và cầu hôn"],
];

/** Trang Cách chơi: vòng chơi TCG 5 bước + bảng lệnh nhanh.
 *  Mọi lệnh đều có bản slash tương ứng (gõ / trong Discord). */
export default function CachChoiPage() {
  return (
    <div className="wrap pub-main">
      <h1>Cách chơi</h1>
      <p className="page-sub">
        Puni chơi ngay trong Discord bằng lệnh bắt đầu bằng <code>!</code> hoặc lệnh slash{" "}
        <code>/</code>. Toàn bộ thẻ, Coins và tiến trình đi theo tài khoản Discord của bạn qua
        mọi server.
      </p>

      <div className="loop-grid guide-steps">
        {STEPS.map((s, i) => (
          <div className="loop-step" key={s.title}>
            <span className="loop-num">{i + 1}</span>
            <h3>{s.title}</h3>
            <p>{s.body}</p>
          </div>
        ))}
      </div>

      <h2 className="guide-h2">Lệnh nhanh</h2>
      <div className="cmd-quick">
        {QUICK_COMMANDS.map(([cmd, desc]) => (
          <div className="cmd-quick-row" key={cmd}>
            <code>{cmd}</code>
            <span>{desc}</span>
          </div>
        ))}
      </div>
      <p className="page-sub">
        Còn 103+ lệnh nữa (economy, minigame, tương tác, AI trò chuyện...) — xem đủ ở{" "}
        <Link href="/commands">Danh sách lệnh</Link>. Mắc ở đâu thì ghé{" "}
        <Link href="/support">Support</Link>.
      </p>
    </div>
  );
}
