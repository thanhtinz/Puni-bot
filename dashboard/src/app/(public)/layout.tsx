import type { ReactNode } from "react";
import Link from "next/link";
import "../globals.css";
import { currentSession } from "@/lib/current-session";

export const metadata = {
  title: "Puni — Bot cộng đồng Discord",
  description:
    "Puni: bot cộng đồng Discord tất cả trong một — chào mừng, log, automod, reaction, minigame và Cozy World.",
};

export default async function PublicLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  return (
    <html lang="vi">
      <body className="pub-body">
        <div className="pub-nav-float">
          <header className="pub-nav">
            <Link href="/" className="brand">
              <img src="/logo.jpg" alt="Puni" className="logo-img brand-logo" />
              puni
            </Link>
            <nav>
              <Link href="/commands">Danh sách lệnh</Link>
              <Link href="/status">Trạng thái</Link>
              <Link href="/dashboard">Dashboard</Link>
            </nav>
            {session ? (
              <>
                <span className="who">{session.username}</span>
                <form action="/api/auth/logout" method="post" style={{ display: "inline" }}>
                  <button className="btn dark sm" type="submit">
                    Đăng xuất
                  </button>
                </form>
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
                  <img src="/logo.jpg" alt="Puni" className="logo-img brand-logo" />
                  puni
                </Link>
                <p className="tagline">
                  Bot cộng đồng Discord tất cả trong một — từ chào mừng, kiểm duyệt tới
                  minigame và Cozy World.
                </p>
              </div>
              <div className="footer-cols">
                <div>
                  <h4>Chính</h4>
                  <Link href="/">Trang chủ</Link>
                  <Link href="/dashboard">Dashboard</Link>
                  <Link href="/commands">Danh sách lệnh</Link>
                  <Link href="/status">Trạng thái</Link>
                </div>
                <div>
                  <h4>Khác</h4>
                  <Link href="/commands">Tính năng</Link>
                  <Link href="/status">Độ ổn định</Link>
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
