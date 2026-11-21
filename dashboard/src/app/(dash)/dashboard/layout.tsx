import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import "../../globals.css";
import { currentSession } from "@/lib/current-session";

export const metadata = { title: "Bảng điều khiển — Puni" };

/** Dashboard shell — completely separate from the public site and
 *  from the owner admin panel (spec: three distinct surfaces). */
export default async function DashboardRootLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/api/auth/login");
  return (
    <html lang="vi">
      <body>
        <div className="shell">
          <aside className="side dash-side">
            <div className="brand">
              Puni<span style={{ color: "var(--accent)" }}>.</span> Dashboard
            </div>
            <Link href="/dashboard" className="item">
              Server của tôi
            </Link>
            <Link href="/commands" className="item">
              Danh sách lệnh
            </Link>
            <Link href="/" className="item">
              Về trang chủ
            </Link>
            <div className="who">
              Đăng nhập: <strong>{session.username}</strong>
              <form action="/api/auth/logout" method="post" style={{ marginTop: 8 }}>
                <button className="btn secondary" type="submit">
                  Đăng xuất
                </button>
              </form>
            </div>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
