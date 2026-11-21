import Link from "next/link";

export default function HomePage() {
  return (
    <>
      <section className="hero">
        <h1>Puni — người bạn nhỏ của server Discord</h1>
        <p>
          Puni lo phần cộng đồng cho server của bạn: chào đón thành viên mới, ghi log đầy đủ,
          kiểm duyệt tự động, reaction vui nhộn, minigame và thế giới Cozy World — tất cả cấu
          hình được ngay trong Discord hoặc trên bảng điều khiển web này.
        </p>
        <p>
          <Link href="/api/auth/login" className="btn">
            Đăng nhập để quản lý server
          </Link>{" "}
          <Link href="/commands" className="btn secondary">
            Xem danh sách lệnh
          </Link>
        </p>
      </section>
      <section className="cards">
        <div className="card">
          <h3>Cộng đồng</h3>
          <p>Tin chào mừng / tạm biệt / boost tuỳ biến từng server, hệ log 5 nhóm sự kiện và automod chặn từ cấm, link và spam chữ hoa.</p>
        </div>
        <div className="card">
          <h3>Kiểm duyệt rõ ràng</h3>
          <p>Mọi hành động mod đều có case đánh số, sửa được lý do, tra cứu lại bất cứ lúc nào — minh bạch cho cả đội quản trị.</p>
        </div>
        <div className="card">
          <h3>Vui là chính</h3>
          <p>69 reaction GIF, coinflip, blackjack, tictactoe, đua thú, nối số / nối chữ và ma sói trọn ván ngay trong server.</p>
        </div>
        <div className="card">
          <h3>Cozy World</h3>
          <p>Game sưu tập sinh vật dùng chung ví economy toàn hệ thống: hunt, battle, lootbox, ngọc gắn và nhiệm vụ mỗi ngày.</p>
        </div>
      </section>
    </>
  );
}
