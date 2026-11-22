import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { onepieceDeckPreview } from "@/lib/onepiece";
import OnePieceArena from "@/components/onepiece-arena";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Sân đấu One Piece (spec 6.39): engine riêng theo luật gốc — DON!!
 * mỗi lượt, gắn DON tăng Power, Blocker chắn đòn, Counter từ tay,
 * Leader mất Life theo đòn đánh.
 */
export default async function MeOnePiecePage() {
  const session = (await currentSession())!;
  const [economy, preview] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    onepieceDeckPreview(session.userId).catch(() => ({
      ready: false, count: 0,
      leader: { name: "Thuyền trưởng Puni", spriteUrl: "", power: 5000, life: 5 },
      deck: [],
    })),
  ]);
  const balance = economy?.balance ?? 0;

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Đấu One Piece</h1>
      <p className="player-sub">Số dư {fmt(balance)} Coins</p>
      <section className="gacha-block">
        <h2>Sân đấu One Piece</h2>
        <OnePieceArena
          previewDeck={preview.deck}
          previewLeader={preview.leader}
          ready={preview.ready}
          count={preview.count}
        />
      </section>
    </div>
  );
}
