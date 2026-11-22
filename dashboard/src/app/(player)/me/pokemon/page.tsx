import { currentSession } from "@/lib/current-session";
import { getUserEconomy } from "@/lib/db";
import { pokemonTeamPreview } from "@/lib/pokemon";
import PokemonArena from "@/components/pokemon-arena";

export const dynamic = "force-dynamic";
const fmt = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 4 });

/**
 * Sân đấu Pokémon (spec 6.39): engine riêng của Pokémon TCG — Active
 * + Bench, năng lượng theo hệ, điểm yếu/kháng, trạng thái, 3 thẻ
 * thưởng phân thắng bại. Đội là 5 lá Pokémon có chiêu thật của bạn.
 */
export default async function MePokemonPage() {
  const session = (await currentSession())!;
  const [economy, preview] = await Promise.all([
    getUserEconomy(session.userId).catch(() => null),
    pokemonTeamPreview(session.userId).catch(() => ({ ready: false, team: [] })),
  ]);
  const balance = economy?.balance ?? 0;

  return (
    <div className="player-body-inner">
      <h1 className="player-title">Đấu Pokémon</h1>
      <p className="player-sub">Số dư {fmt(balance)} Coins</p>
      <section className="gacha-block">
        <h2>Sân đấu Pokémon</h2>
        <PokemonArena previewTeam={preview.team} ready={preview.ready} />
      </section>
    </div>
  );
}
