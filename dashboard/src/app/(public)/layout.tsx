import type { ReactNode } from "react";
import Link from "next/link";
import "../globals.css";
import { currentSession } from "@/lib/current-session";
import { getSiteSetting } from "@/lib/db";

export const metadata = {
  title: "Puni — Bot cộng đồng Discord",
  description:
    "Puni: bot cộng đồng Discord tất cả trong một — chào mừng, log, automod, reaction, minigame và game thú cưng.",
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
            <nav>
              <Link href="/commands">Danh sách lệnh</Link>
              <Link href="/timestamps">Timestamps</Link>
              <Link href="/membership">Hội viên</Link>
              {supportUrl ? (
                <a href={supportUrl} target="_blank" rel="noreferrer">
                  Support
                </a>
              ) : null}
              <Link href="/status">Trạng thái</Link>
            </nav>
            {session ? (
              <>
                <span className="who">{session.username}</span>
                <Link href="/dashboard" className="btn dark sm">
                  Dashboard
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
                  Bot cộng đồng Discord tất cả trong một — từ chào mừng, kiểm duyệt tới
                  minigame và game thú cưng.
                </p>
              </div>
              <div className="footer-cols">
                <div>
                  <h4>Chính</h4>
                  <Link href="/">Trang chủ</Link>
                  <Link href="/commands">Danh sách lệnh</Link>
                  <Link href="/timestamps">Timestamps</Link>
                  <Link href="/membership">Hội viên</Link>
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
