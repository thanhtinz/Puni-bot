import { currentSession } from "@/lib/current-session";
import { pokemonTeamPreview } from "@/lib/pokemon";
import PokemonArena from "@/components/pokemon-arena";

export const dynamic = "force-dynamic";

/**
 * Sân đấu Pokémon (spec 6.39): engine riêng của Pokémon TCG — Active
 * + Bench, năng lượng theo hệ, điểm yếu/kháng, trạng thái, 3 thẻ
 * thưởng phân thắng bại. Trang chỉ còn sân đấu tràn màn hình; số dư
 * chỉ hiện ở header.
 */
export default async function MePokemonPage() {
  const session = (await currentSession())!;
  const preview = await pokemonTeamPreview(session.userId).catch(() => ({
    ready: false, team: [],
  }));

  return (
    <div className="player-body-inner">
      <PokemonArena previewTeam={preview.team} ready={preview.ready} />
    </div>
  );
}
