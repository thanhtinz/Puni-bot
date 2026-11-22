import { currentSession } from "@/lib/current-session";
import { getUserEconomy, getUserMembership } from "@/lib/db";
import { getProfile } from "@/lib/player";
import { userInstances, dexTotalSpecies } from "@/lib/tcg";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

export default async function MeProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; err?: string }>;
}) {
  const session = (await currentSession())!;
  const sp = await searchParams;
  const [profile, economy, membership, instances, totalSpecies] = await Promise.all([
    getProfile(session.userId),
    getUserEconomy(session.userId).catch(() => null),
    getUserMembership(session.userId).catch(() => null),
    userInstances(session.userId),
    dexTotalSpecies().catch(() => 0),
  ]);
  const species = new Set(instances.map((i) => i.speciesId)).size;
  return (
    <div className="player-body-inner">
      <h1>Hồ sơ của {session.username}</h1>
      {sp.saved ? <p className="player-notice ok">Đã lưu hồ sơ.</p> : null}
      {sp.err ? <p className="player-notice err">{sp.err}</p> : null}
      <div className="player-cards">
        <div className="player-card">
          <h3>{fmt(economy?.balance ?? 0)}</h3>
          <p>Coins trong ví (dùng chung toàn hệ thống)</p>
        </div>
        <div className="player-card">
          <h3>{instances.length} lá · {species}/{totalSpecies.toLocaleString("en-US")} loài</h3>
          <p>Thẻ TCG đang sở hữu — xem ở Kho Thẻ và Sổ Dex</p>
        </div>
        <div className="player-card">
          <h3>{membership?.active ? membership.tier_id : "Chưa có"}</h3>
          <p>{membership?.active ? `Hội viên còn hạn tới ${new Date(membership.expires_at).toLocaleDateString("vi-VN")}` : "Gói hội viên Membership"}</p>
        </div>
      </div>
      <section className="player-panel">
        <h2>Thẻ profile của bạn</h2>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/api/me/profile-card" alt="Thẻ profile" style={{ width: "100%", maxWidth: 645, borderRadius: 14, display: "block" }} />
        <p style={{ marginTop: 10 }}>
          <a href="/api/me/profile-card" download="puni-profile.png">Tải thẻ profile (PNG)</a>
        </p>
      </section>
      <section className="player-panel">
        <h2>Thông tin profile (hiện trên thẻ profile game)</h2>
        <form method="post" action="/api/me/profile" className="player-form">
          <label>
            Giới tính
            <input type="text" name="gender" defaultValue={profile.gender} maxLength={30} placeholder="Ví dụ: Nam / Nữ" />
          </label>
          <label>
            Ngày sinh
            <input type="date" name="birthday" defaultValue={profile.birthday ?? ""} />
          </label>
          <label>
            Sở thích
            <input type="text" name="hobby" defaultValue={profile.hobby} maxLength={120} placeholder="Ví dụ: Sưu tầm thẻ, nghe nhạc" />
          </label>
          <label>
            Mối quan hệ / trạng thái
            <input type="text" name="statusText" defaultValue={profile.statusText} maxLength={120} placeholder="Ví dụ: Độc thân vui tính" />
          </label>
          <button type="submit" className="player-btn">Lưu hồ sơ</button>
        </form>
        <p className="player-hint">Thông tin này do bạn tự khai và hiện trên thẻ profile trong game. Quan hệ hôn nhân trong game (khi có) sẽ tự ghi đè dòng Mối quan hệ.</p>
      </section>
    </div>
  );
}
