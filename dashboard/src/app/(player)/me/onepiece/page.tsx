import { currentSession } from "@/lib/current-session";
import { onepieceDeckPreview } from "@/lib/onepiece";
import OnePieceArena from "@/components/onepiece-arena";

export const dynamic = "force-dynamic";

/**
 * Sân đấu One Piece (spec 6.39): engine riêng theo luật gốc — DON!!
 * mỗi lượt, gắn DON tăng Power, Blocker chắn đòn, Counter từ tay,
 * Leader mất Life theo đòn đánh. Trang chỉ còn sân đấu tràn màn
 * hình; số dư chỉ hiện ở header.
 */
export default async function MeOnePiecePage() {
  const session = (await currentSession())!;
  const preview = await onepieceDeckPreview(session.userId).catch(() => ({
    ready: false, count: 0,
    leader: { name: "Thuyền trưởng Puni", spriteUrl: "", power: 5000, life: 5 },
    deck: [],
  }));

  return (
    <div className="player-body-inner">
      <OnePieceArena
        previewDeck={preview.deck}
        previewLeader={preview.leader}
        ready={preview.ready}
        count={preview.count}
      />
    </div>
  );
}
