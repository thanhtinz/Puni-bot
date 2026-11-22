import { currentSession } from "@/lib/current-session";
import { yugiohDeckPreview } from "@/lib/yugioh";
import YugiohArena from "@/components/yugioh-arena";

export const dynamic = "force-dynamic";

/**
 * Sân đấu Yu-Gi-Oh (spec 6.39): engine riêng theo luật gốc — LP
 * 8000, triệu hồi hiến tế theo cấp sao, thế công/thế thủ, chỉ số
 * ATK/DEF thật từ YGOPRODeck. Trang chỉ còn sân đấu tràn màn hình;
 * số dư chỉ hiện ở header.
 */
export default async function MeYugiohPage() {
  const session = (await currentSession())!;
  const preview = await yugiohDeckPreview(session.userId).catch(() => ({
    ready: false, count: 0, deck: [],
  }));

  return (
    <div className="player-body-inner">
      <YugiohArena previewDeck={preview.deck} ready={preview.ready} count={preview.count} />
    </div>
  );
}
