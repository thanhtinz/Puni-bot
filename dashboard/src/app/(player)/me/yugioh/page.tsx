import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { yugiohDeckPreview } from "@/lib/yugioh";
import YugiohArena from "@/components/yugioh-arena";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Sân đấu Yu-Gi-Oh (spec 6.39): engine riêng theo luật gốc — LP
 * 8000, triệu hồi hiến tế theo cấp sao, thế công/thế thủ, chỉ số
 * ATK/DEF thật từ YGOPRODeck.
 */
export default async function MeYugiohPage() {
  const session = (await currentSession())!;
  const [economy, preview] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    yugiohDeckPreview(session.userId).catch(() => ({ ready: false, count: 0, deck: [] })),
  ]);
  const balance = economy?.balance ?? 0;

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Đấu Yu-Gi-Oh</h1>
      <p className="player-sub">Số dư {fmt(balance)} Coins</p>
      <section className="gacha-block">
        <h2>Sân đấu Yu-Gi-Oh</h2>
        <YugiohArena previewDeck={preview.deck} ready={preview.ready} count={preview.count} />
      </section>
    </div>
  );
}
