import type { ReactNode } from "react";
import Link from "next/link";
import "../globals.css";
import { currentSession } from "@/lib/current-session";
import { getSiteSetting } from "@/lib/db";
import { Burger } from "@/components/burger";
import { IconDiscord, IconLogin } from "@/components/icons";
import { botInviteUrl } from "@/lib/invite";

export const metadata = {
  title: "Puni — Bot game thẻ bài TCG trên Discord",
  description:
    "Puni: bot game thẻ bài TCG trên Discord — mở gói, sưu tầm thẻ, đấu hạng, chợ người chơi, economy toàn hệ thống và kết hôn.",
};

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  const supportUrl = await getSiteSetting("support_url").catch(() => null);
  const inviteUrl = botInviteUrl();
  return (
    <html lang="vi">
      <body className="pub-body">
        <div className="pub-nav-float">
          <header className="pub-nav">
            <Link href="/" className="brand">
              <img src="/api/assets/logo" alt="Puni" className="logo-img brand-logo" />
              Puni
            </Link>
            <Burger variant="dropdown">
            <nav>
              <Link href="/commands">Danh sách lệnh</Link>
              {supportUrl ? (
                <a href={supportUrl} target="_blank" rel="noreferrer">
                  Support
                </a>
              ) : (
                <Link href="/support">Support</Link>
              )}
              <Link href="/status">Trạng thái</Link>
              <Link href="/cach-choi">Cách chơi</Link>
            </nav>
            </Burger>
            <div className="pub-nav-actions">
              {inviteUrl ? (
                <a href={inviteUrl} target="_blank" rel="noreferrer" className="btn secondary sm header-invite">
                  <IconDiscord size={16} />
                  Mời bot
                </a>
              ) : null}
              {session ? (
                <Link href="/me" className="btn dark sm">
                  Khu người chơi
                </Link>
              ) : (
                <Link href="/api/auth/login" className="btn dark sm">
                  <IconLogin size={16} />
                  Login
                </Link>
              )}
            </div>
          </header>
        </div>
        {children}
        <footer className="pub-footer">
          <div className="wrap">
            <div className="footer-grid">
              <div className="footer-brand">
                <Link href="/" className="brand" style={{ display: "flex", alignItems: "center", gap: 10, fontFamily: "var(--font-display)", fontWeight: 800, fontSize: 24, color: "var(--cream)" }}>
                  <img src="/api/assets/logo" alt="Puni" className="logo-img brand-logo" />
                  Puni
                </Link>
                <p className="tagline">
                  Bot game thẻ bài TCG trên Discord — sưu tầm thẻ, đấu hạng, chợ người
                  chơi, economy toàn hệ thống và kết hôn.
                </p>
              </div>
              <div className="footer-cols">
                <div>
                  <h4>Chính</h4>
                  <Link href="/">Trang chủ</Link>
                  <Link href="/commands">Danh sách lệnh</Link>
                  <Link href="/cach-choi">Cách chơi</Link>
                  <Link href="/status">Trạng thái</Link>
                </div>
                <div>
                  <h4>Khác</h4>
                  <Link href="/commands">Tính năng</Link>
                  <Link href="/status">Độ ổn định</Link>
                  {supportUrl ? (
                    <a href={supportUrl} target="_blank" rel="noreferrer">
                      Support
                    </a>
                  ) : (
                    <Link href="/support">Support</Link>
                  )}
                  <Link href="/api/auth/login">Đăng nhập</Link>
                </div>
              </div>
            </div>
            <p className="footer-base">Puni — một sản phẩm trong hệ sinh thái BNT.</p>
          </div>
        </footer>
      </body>
    </html>
  );
}
