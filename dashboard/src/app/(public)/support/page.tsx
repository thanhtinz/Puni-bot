import Link from "next/link";
import { getSiteSetting } from "@/lib/db";
import { botInviteUrl } from "@/lib/invite";
import { IconDiscord } from "@/components/icons";

export const dynamic = "force-dynamic";

export const metadata = {
  title: "Support — Puni",
  description: "Kênh hỗ trợ của Puni: server Discord hỗ trợ, danh sách lệnh và cách chơi.",
};

/** Trang Support công khai: kênh liên hệ chính + lối tắt tới các trang
 *  tự tra cứu. Link server hỗ trợ lấy từ Admin → Trang web (support_url);
 *  chưa cấu hình thì nói rõ thay vì hiện link chết. */
export default async function SupportPage() {
  const supportUrl = await getSiteSetting("support_url").catch(() => null);
  const inviteUrl = botInviteUrl();
  return (
    <div className="wrap pub-main">
      <h1>Support</h1>
      <p className="page-sub">
        Cần giúp đỡ về lệnh, thẻ bài hay tài khoản? Bắt đầu từ các kênh dưới đây.
      </p>
      <div className="link-cards">
        <div className="link-card">
          <h3>Server Discord hỗ trợ</h3>
          <p>Kênh chính để báo lỗi, hỏi đáp và nhận thông báo cập nhật từ đội ngũ Puni.</p>
          {supportUrl ? (
            <a href={supportUrl} target="_blank" rel="noreferrer" className="btn secondary sm">
              <IconDiscord size={16} />
              Vào server hỗ trợ
            </a>
          ) : (
            <p className="notice-inline">Link server hỗ trợ đang được cập nhật.</p>
          )}
        </div>
        <div className="link-card">
          <h3>Tự tra cứu trước</h3>
          <p>
            Phần lớn thắc mắc nằm ở <Link href="/cach-choi">Cách chơi</Link> và{" "}
            <Link href="/commands">Danh sách lệnh</Link> — tra nhanh hơn chờ trả lời.
          </p>
          <Link href="/cach-choi" className="btn ghost sm">
            Xem cách chơi
          </Link>
        </div>
        <div className="link-card">
          <h3>Bot không phản hồi?</h3>
          <p>
            Kiểm tra <Link href="/status">Trạng thái hệ thống</Link> trước — nếu bot đang bảo
            trì, trang đó hiện rõ. Bot chưa có mặt trong server của bạn thì mời bot về trước.
          </p>
          {inviteUrl ? (
            <a href={inviteUrl} target="_blank" rel="noreferrer" className="btn ghost sm">
              <IconDiscord size={16} />
              Mời bot về server
            </a>
          ) : (
            <Link href="/status" className="btn ghost sm">
              Xem trạng thái
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
