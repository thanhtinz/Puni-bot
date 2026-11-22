import type { ReactNode } from "react";
import Link from "next/link";
import "../globals.css";
import { currentSession } from "@/lib/current-session";
import { getSiteSetting } from "@/lib/db";
import { Burger } from "@/components/burger";

export const metadata = {
  title: "Puni — Bot game thẻ bài TCG trên Discord",
  description:
    "Puni: bot game thẻ bài TCG trên Discord — mở gói, sưu tầm thẻ, đấu hạng, chợ người chơi, economy toàn hệ thống và kết hôn.",
};

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  const supportUrl = await getSiteSetting("support_url").catch(() => null);
  return (
    <html lang="vi">
      <body className="pub-body">
        <div className="pub-nav-float">
          <header className="pub-nav">
            <Link href="/" className="brand">
              <img src="/api/assets/logo" alt="Puni" className="logo-img brand-logo" />
              Puni
            </Link>
            <Burger>
            <nav>
              <Link href="/commands">Danh sách lệnh</Link>
              <Link href="/timestamps">Timestamps</Link>
              {supportUrl ? (
                <a href={supportUrl} target="_blank" rel="noreferrer">
                  Support
                </a>
              ) : null}
              <Link href="/status">Trạng thái</Link>
            </nav>
            </Burger>
            {session ? (
              <>
                <span className="who">{session.username}</span>
                <Link href="/me" className="btn dark sm">
                  Khu người chơi
                </Link>
              </>
            ) : (
              <Link href="/api/auth/login" className="btn dark sm">
                Đăng nhập bằng Discord
              </Link>
            )}
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
                  <Link href="/timestamps">Timestamps</Link>
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
                  ) : null}
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
