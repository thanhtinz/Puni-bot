import { currentSession } from "@/lib/current-session";
import { dragonballDeckPreview } from "@/lib/dragonball";
import DragonBallArena from "@/components/dragonball-arena";

export const dynamic = "force-dynamic";

/**
 * Sân đấu Dragon Ball Fusion World (spec 6.39): engine riêng theo
 * luật gốc — 8 Life, đặt Energy mỗi lượt, trả Cost ra Battle Card,
 * Combo từ tay cộng Power, Awaken khi Life còn 4. Trang chỉ còn sân
 * đấu tràn màn hình; số dư chỉ hiện ở header.
 */
export default async function MeDragonBallPage() {
  const session = (await currentSession())!;
  const preview = await dragonballDeckPreview(session.userId).catch(() => ({
    ready: false, count: 0,
    leader: { name: "Chiến binh Puni", spriteUrl: "", power: 15000, powerAwake: 20000 },
    deck: [],
  }));

  return (
    <div className="player-body-inner">
      <DragonBallArena
        previewDeck={preview.deck}
        previewLeader={preview.leader}
        ready={preview.ready}
        count={preview.count}
      />
    </div>
  );
}
