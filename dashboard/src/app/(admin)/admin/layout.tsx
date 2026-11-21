import type { ReactNode } from "react";
import Link from "next/link";
import "../../globals.css";
import { currentSession } from "@/lib/current-session";
import { isOwner } from "@/lib/session";

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
              <div className="brand"><span className="brand-dot">P</span> Puni Admin</div>
              <Link href="/admin" className="item">
                Tổng quan
              </Link>
              <Link href="/admin/resellers" className="item">
                Reseller
              </Link>
              <Link href="/admin/clusters" className="item">
                Cluster &amp; Shard
              </Link>
              <div className="who" style={{ marginTop: "auto", fontSize: 13, color: "#7e8798" }}>
                Chủ bot: <strong>{session.username}</strong>
                <form action="/api/auth/logout" method="post" style={{ marginTop: 8 }}>
                  <button className="btn secondary sm" type="submit">
                    Đăng xuất
                  </button>
                </form>
              </div>
            </aside>
            <main className="content admin-content">{children}</main>
          </div>
        )}
      </body>
    </html>
  );
}
