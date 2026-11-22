import { currentSession } from "@/lib/current-session";
import { digimonDeckPreview } from "@/lib/digimon";
import DigimonArena from "@/components/digimon-arena";

export const dynamic = "force-dynamic";

/**
 * Sân đấu Digimon (spec 6.39i): engine riêng theo luật gốc — Memory
 * Gauge dùng chung, chồng Security 5 lá, khu Breeding, tiến hoá theo
 * cấp + màu in trên lá. Trang chỉ còn sân đấu tràn màn hình; số dư
 * chỉ hiện ở header.
 */
export default async function MeDigimonPage() {
  const session = (await currentSession())!;
  const preview = await digimonDeckPreview(session.userId).catch(() => ({
    ready: false, count: 0, deck: [],
  }));

  return (
    <div className="player-body-inner">
      <DigimonArena previewDeck={preview.deck} ready={preview.ready} count={preview.count} />
    </div>
  );
}
