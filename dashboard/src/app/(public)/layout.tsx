import type { ReactNode } from "react";
import Link from "next/link";
import "../globals.css";
import { currentSession } from "@/lib/current-session";

export const metadata = {
  title: "Puni — Bot cộng đồng Discord",
  description: "Puni: bot cộng đồng Discord — chào mừng, kiểm duyệt, log, reaction, minigame và Cozy World.",
};

export default async function RootLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  return (
    <html lang="vi">
      <body>
        <header className="pub-header">
          <Link href="/" className="brand">
            Puni<span>.</span>
          </Link>
          <nav>
            <Link href="/commands">Danh sách lệnh</Link>
            <Link href="/status">Trạng thái</Link>
            {session ? (
              <>
                <Link href="/dashboard">Bảng điều khiển</Link>
                <span>{session.username}</span>
                <form action="/api/auth/logout" method="post" style={{ display: "inline" }}>
                  <button className="btn secondary" type="submit">
                    Đăng xuất
                  </button>
                </form>
              </>
            ) : (
              <Link href="/api/auth/login" className="btn">
                Đăng nhập bằng Discord
              </Link>
            )}
          </nav>
        </header>
        <main className="pub-main">{children}</main>
        <footer className="pub-footer">
          Puni — bot cộng đồng Discord. Một sản phẩm trong hệ sinh thái BNT.
        </footer>
      </body>
    </html>
  );
}
