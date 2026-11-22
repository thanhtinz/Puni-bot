import Link from "next/link";
import { redirect } from "next/navigation";
import { currentSession } from "@/lib/current-session";
import { canManagePuni } from "@/lib/landing";

export const dynamic = "force-dynamic";

/**
 * Two-choice landing after login (owner decision 2026-11-21 20:54):
 * users who manage a Puni server pick where to go — the server
 * dashboard or the player area. Everyone else is sent to /me.
 */
export default async function WelcomePage() {
  const session = await currentSession();
  if (!session) redirect("/api/auth/login");
  if (!(await canManagePuni(session).catch(() => false))) redirect("/me");
  return (
    <div className="wrap">
      <h1>Chào {session.username}, bạn muốn vào đâu?</h1>
      <p style={{ color: "var(--muted)", lineHeight: 1.6, maxWidth: 640 }}>
        Tài khoản của bạn vừa là quản trị viên server có Puni, vừa là người chơi.
        Chọn một khu — qua lại giữa hai khu lúc nào cũng được.
      </p>
      <div className="choice-grid">
        <Link href="/dashboard" className="choice-card">
          <h2>Quản lý server</h2>
          <p>Cấu hình Puni cho các server bạn quản trị: tiền tố, chào mừng, log, automod, AI trò chuyện…</p>
          <span className="btn">Vào Dashboard</span>
        </Link>
        <Link href="/me" className="choice-card">
          <h2>Khu người chơi</h2>
          <p>Hồ sơ của bạn, sổ dex, kho thẻ, bộ bài, chợ thẻ và trao đổi với người chơi khác.</p>
          <span className="btn">Vào khu người chơi</span>
        </Link>
      </div>
    </div>
  );
}
