import type { ReactNode } from "react";
import Link from "next/link";
import "../globals.css";
import { currentSession } from "@/lib/current-session";
import { Burger } from "@/components/burger";
import { canManagePuni } from "@/lib/landing";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Khu người chơi — Puni",
  description: "Hồ sơ, sổ dex, kho thẻ, bộ bài, chợ và trao đổi của người chơi Puni.",
};

/** Player area shell (spec 6.24) — fully separate from the server
 *  dashboard and the owner admin panel. */
export default async function PlayerLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/api/auth/login");
  const managesPuni = await canManagePuni(session).catch(() => false);
  return (
    <html lang="vi">
      <body className="player-body">
        <div className="player-shell">
          <header className="player-top">
            <Link href="/" className="player-brand">
              <img src="/api/assets/logo" alt="Puni" className="logo-img brand-logo" />
              Puni · Khu người chơi
            </Link>
            <span className="player-who">
              {session.username} · <a href="/api/auth/logout">Đăng xuất</a>
            </span>
          </header>
          <nav className="player-tabs" aria-label="Khu người chơi">
            <Burger>
            <Link href="/me" className="player-tab">Hồ Sơ</Link>
            <Link href="/me/dex" className="player-tab">Sổ Dex</Link>
            <Link href="/me/cards" className="player-tab">Kho Thẻ</Link>
            <Link href="/me/decks" className="player-tab">Bộ Bài</Link>
            <Link href="/me/market" className="player-tab">Chợ Thẻ</Link>
            <Link href="/me/trades" className="player-tab">Trao Đổi</Link>
            {managesPuni ? <Link href="/dashboard" className="player-tab">Quản Lý Server</Link> : null}
            </Burger>
          </nav>
          {children}
        </div>
      </body>
    </html>
  );
}
