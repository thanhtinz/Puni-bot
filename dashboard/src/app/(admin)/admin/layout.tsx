import type { ReactNode } from "react";
import Link from "next/link";
import "../../globals.css";
import { currentSession } from "@/lib/current-session";
import { IconActivity, IconBag, IconChart, IconCoins, IconGrid, IconHome, IconPaw, IconGlobe, IconShield, IconSpark, IconUsers } from "@/components/icons";
import { isOwner } from "@/lib/session";
import { Burger } from "@/components/burger";

export const metadata = { title: "Puni Admin" };

/**
 * Owner admin panel shell — a SEPARATE surface from both the public
 * site and the user dashboard (spec 15:13 ruling): different layout,
 * menu, header and footer; dashboard users never see this exists.
 * Access: Discord session of the owner's ID only; pages additionally
 * enforce the second factor when configured.
 */
export default async function AdminRootLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  return (
    <html lang="vi">
      <body className="admin-body">
        {!session ? (
          <main className="content admin-content" style={{ maxWidth: 520, margin: "60px auto" }}>
            <h1>Puni Admin</h1>
            <p>Khu vực quản trị hệ thống. Cần đăng nhập bằng tài khoản Discord của chủ bot.</p>
            <Link href="/api/auth/login" className="btn">
              Đăng nhập bằng Discord
            </Link>
          </main>
        ) : !isOwner(session) ? (
          <main className="content admin-content" style={{ maxWidth: 520, margin: "60px auto" }}>
            <h1>Không có quyền truy cập</h1>
            <p>Tài khoản {session.username} không phải chủ bot. Khu vực này chỉ dành cho chủ sở hữu Puni.</p>
            <form action="/api/auth/logout" method="post">
              <button className="btn secondary sm" type="submit">
                Đăng xuất
              </button>
            </form>
          </main>
        ) : (
          <div className="shell">
            <aside className="side admin-side">
              <div className="brand"><img src="/api/assets/logo" alt="Puni" className="logo-img brand-logo" /> Puni Admin</div>
              <Burger
                tone="dark"
                footer={
                  <div className="who" style={{ marginTop: "auto", fontSize: 13, color: "#8fb0e8" }}>
                Chủ bot: <strong>{session.username}</strong>
                <form action="/api/auth/logout" method="post" style={{ marginTop: 8 }}>
                  <button className="btn secondary sm" type="submit">
                    Đăng xuất
                  </button>
                </form>
              </div>
                }
              >
              <Link href="/admin" className="item">
                <IconHome /> Tổng quan
              </Link>
              <Link href="/admin/ops" className="item">
                <IconActivity /> Vận hành
              </Link>
              <Link href="/admin/economy" className="item">
                <IconCoins /> Economy
              </Link>
              <Link href="/admin/membership" className="item">
                <IconSpark /> Membership
              </Link>
              <Link href="/admin/vote" className="item">
                <IconChart /> Vote (top.gg)
              </Link>
              <Link href="/admin/users" className="item">
                <IconUsers /> Người dùng
              </Link>
              <Link href="/admin/ai" className="item">
                <IconSpark /> AI trò chuyện
              </Link>
              <Link href="/admin/clusters" className="item">
                <IconGrid /> Cluster &amp; Shard
              </Link>
              <Link href="/admin/pets" className="item">
                <IconPaw /> Loài thẻ
              </Link>
              <Link href="/admin/rulings" className="item">
                <IconShield /> Rulings
              </Link>
              <Link href="/admin/website" className="item">
                <IconGlobe /> Trang web
              </Link>
              
              </Burger>
            </aside>
            <main className="content admin-content">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
