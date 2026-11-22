import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { dragonballDeckPreview } from "@/lib/dragonball";
import DragonBallArena from "@/components/dragonball-arena";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Sân đấu Dragon Ball Fusion World (spec 6.39): engine riêng theo
 * luật gốc — 8 Life, đặt Energy mỗi lượt, trả Cost ra Battle Card,
 * Combo từ tay cộng Power, Awaken khi Life còn 4.
 */
export default async function MeDragonBallPage() {
  const session = (await currentSession())!;
  const [economy, preview] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    dragonballDeckPreview(session.userId).catch(() => ({
      ready: false, count: 0,
      leader: { name: "Chiến binh Puni", spriteUrl: "", power: 15000, powerAwake: 20000 },
      deck: [],
    })),
  ]);
  const balance = economy?.balance ?? 0;

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Đấu Dragon Ball</h1>
      <p className="player-sub">Số dư {fmt(balance)} Coins</p>
      <section className="gacha-block">
        <h2>Sân đấu Dragon Ball Fusion World</h2>
        <DragonBallArena
          previewDeck={preview.deck}
          previewLeader={preview.leader}
          ready={preview.ready}
          count={preview.count}
        />
      </section>
    </div>
  );
}
