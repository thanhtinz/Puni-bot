import type { ReactNode } from "react";
import Link from "next/link";
import { currentSession } from "@/lib/current-session";
import { canManageGuild } from "@/lib/session";

export default async function GuildLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ guildId: string }>;
}) {
  const { guildId } = await params;
  const session = await currentSession();
  if (!session || !canManageGuild(session, guildId)) {
    return (
      <div className="notice">
        Bạn không có quyền quản lý server này. Cần quyền Quản lý server hoặc Quản trị viên
        trong server đó.
      </div>
    );
  }
  const guild = session.guilds.find((g) => g.id === guildId);
  const base = `/dashboard/${guildId}`;
  return (
    <>
      <h1 style={{ marginBottom: 4 }}>{guild?.name || "Server"}</h1>
      <p style={{ color: "var(--muted)", marginTop: 0 }}>ID: {guildId}</p>
      <nav className="guild-nav">
        <Link href={base}>Tổng quan</Link>
        <Link href={`${base}/community`}>Chào mừng &amp; Boost</Link>
        <Link href={`${base}/logging`}>Log</Link>
        <Link href={`${base}/automod`}>Automod</Link>
        <Link href={`${base}/ai-chat`}>AI trò chuyện</Link>
        <Link href={`${base}/branding`}>Thương hiệu</Link>
      </nav>
      {children}
    </>
  );
}
