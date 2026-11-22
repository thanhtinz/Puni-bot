import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import "../../globals.css";
import { currentSession } from "@/lib/current-session";
import { IconHome, IconList, IconServer } from "@/components/icons";
import { Burger } from "@/components/burger";

export const metadata = { title: "Bảng điều khiển — Puni" };

/** Dashboard shell — completely separate from the public site and
 *  from the owner admin panel (spec: three distinct surfaces). */
export default async function DashboardRootLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/api/auth/login");
  return (
    <html lang="vi">
      <body className="dash-body">
        <div className="shell">
          <aside className="side dash-side">
            <div className="brand">
              <img src="/api/assets/logo" alt="Puni" className="logo-img brand-logo" /> Dashboard
            </div>
            <Burger
              tone="dark"
              footer={
                <div className="who">
                  Đăng nhập: <strong>{session.username}</strong>
                  <form action="/api/auth/logout" method="post" style={{ marginTop: 8 }}>
                    <button className="btn secondary sm" type="submit">
                      Đăng xuất
                    </button>
                  </form>
                </div>
              }
            >
              <Link href="/dashboard" className="item">
                <IconServer /> Server của tôi
              </Link>
              <Link href="/commands" className="item">
                <IconList /> Danh sách lệnh
              </Link>
              <Link href="/" className="item">
                <IconHome /> Về trang chủ
              </Link>
            </Burger>
          </aside>
          <main className="content">{children}</main>
        </div>
      </body>
    </html>
  );
}
