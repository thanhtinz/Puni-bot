import type { ReactNode } from "react";
import Link from "next/link";
import "../globals.css";
import { currentSession } from "@/lib/current-session";
import { Burger } from "@/components/burger";
import { NavGroup } from "@/components/nav-group";
import {
  IconActivity, IconBag, IconCards, IconChart, IconCoins, IconEmbed, IconFrame, IconGlobe, IconGrid,
  IconClock, IconHome, IconList, IconLogout, IconPaw, IconQuest, IconSearch, IconShield, IconSpark, IconTrophy, IconUsers, IconWallet,
} from "@/components/icons";
import { db } from "@/lib/db";
import { redirect } from "next/navigation";

export const metadata = {
  title: "Khu người chơi — Puni",
  description: "Hồ sơ, sổ dex, kho thẻ, bộ bài, chợ và trao đổi của người chơi Puni.",
};

const fmtCoins = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

async function playerBalance(userId: string): Promise<number | null> {
  try {
    const res = await db().query<{ balance: string }>(
      `SELECT balance::text AS balance FROM economy_accounts WHERE user_id = $1`,
      [userId],
    );
    return res.rows[0] ? Number(res.rows[0].balance) : 0;
  } catch {
    return null;
  }
}

/** Player area shell (spec 6.24) — fully separate from the server
 *  dashboard and the owner admin panel. Header rebuilt 2026-11-22:
 *  one sticky white bar carrying the burger button (the drawer holds
 *  every tab plus Đăng xuất), the brand block, the live Coins balance
 *  pill and the user chip with Discord avatar. */
export default async function PlayerLayout({ children }: { children: ReactNode }) {
  const session = await currentSession();
  if (!session) redirect("/api/auth/login");
  const balance = await playerBalance(session.userId);
  const avatarUrl = session.avatar
    ? `https://cdn.discordapp.com/avatars/${session.userId}/${session.avatar}.png?size=64`
    : null;
  return (
    <html lang="vi">
      <body className="player-body">
        <div className="player-shell">
          <div className="player-head">
            <header className="player-top">
              <div className="player-head-left">
                <Burger
                  tone="light"
                  footer={
                    <a href="/api/auth/logout" className="player-tab drawer-logout">
                      <IconLogout size={16} />Đăng xuất
                    </a>
                  }
                >
                  <Link href="/me" className="player-tab"><IconHome size={16} />Hồ Sơ</Link>
                  <Link href="/me/membership" className="player-tab"><IconSpark size={16} />Hội Viên</Link>
                  <NavGroup
                    icon={<IconCards size={16} />}
                    label="TCG"
                    paths={[
                      "/me/dex", "/me/cards", "/me/showcase", "/me/gacha", "/me/shop",
                      "/me/battle", "/me/pokemon", "/me/yugioh", "/me/onepiece", "/me/dragonball", "/me/tournament", "/me/decks", "/me/deck-search",
                      "/me/market", "/me/cho", "/me/auction", "/me/trades", "/me/quests",
                    ]}
                  >
                    <Link href="/me/dex" className="player-tab"><IconGrid size={16} />Sổ Dex</Link>
                    <Link href="/me/cards" className="player-tab"><IconEmbed size={16} />Kho Thẻ</Link>
                    <Link href="/me/showcase" className="player-tab"><IconFrame size={16} />Trưng Bày</Link>
                    <Link href="/me/gacha" className="player-tab"><IconBag size={16} />Mở Thẻ</Link>
                    <Link href="/me/shop" className="player-tab"><IconCoins size={16} />Shop</Link>
                    <Link href="/me/battle" className="player-tab"><IconActivity size={16} />Đấu Thẻ</Link>
                    <Link href="/me/pokemon" className="player-tab"><IconPaw size={16} />Đấu Pokémon</Link>
                    <Link href="/me/yugioh" className="player-tab"><IconShield size={16} />Đấu Yu-Gi-Oh</Link>
                    <Link href="/me/onepiece" className="player-tab"><IconGlobe size={16} />Đấu One Piece</Link>
                    <Link href="/me/dragonball" className="player-tab"><IconSpark size={16} />Đấu Dragon Ball</Link>
                    <Link href="/me/tournament" className="player-tab"><IconTrophy size={16} />Giải Đấu</Link>
                    <Link href="/me/decks" className="player-tab"><IconList size={16} />Bộ Bài</Link>
                    <Link href="/me/deck-search" className="player-tab"><IconSearch size={16} />Tìm Bộ Bài</Link>
                    <Link href="/me/market" className="player-tab"><IconChart size={16} />Thị Trường</Link>
                    <Link href="/me/cho" className="player-tab"><IconWallet size={16} />Chợ Thẻ</Link>
                    <Link href="/me/auction" className="player-tab"><IconClock size={16} />Đấu Giá</Link>
                    <Link href="/me/trades" className="player-tab"><IconUsers size={16} />Trao Đổi</Link>
                    <Link href="/me/quests" className="player-tab"><IconQuest size={16} />Nhiệm Vụ</Link>
                  </NavGroup>
                </Burger>
                <Link href="/" className="player-brand">
                  <img src="/api/assets/logo" alt="Puni" className="logo-img brand-logo player-logo" />
                  <span className="player-brand-text">
                    <strong>Puni</strong>
                    <small>KHU NGƯỜI CHƠI</small>
                  </span>
                </Link>
              </div>
              <div className="player-head-right">
                {balance !== null ? (
                  <span className="player-balance" title="Số dư Coins của bạn">
                    <IconCoins size={16} />
                    {fmtCoins(balance)}
                  </span>
                ) : null}
                <span className="player-userchip">
                  {avatarUrl ? (
                    <img src={avatarUrl} alt="" className="player-avatar" />
                  ) : (
                    <span className="player-avatar player-avatar-fallback">
                      {(session.username ?? "?").slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <span className="player-uname">{session.username}</span>
                </span>
              </div>
            </header>
          </div>
          {children}
        </div>
      </body>
    </html>
  );
}
