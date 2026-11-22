/**
 * Card artwork (spec 6.29): renders the species' real artwork from
 * game_species.sprite_url — local /op/*.jpg for One Piece, the
 * TCGplayer CDN for the other APITCG families. Epic and rarer cards
 * get the animated holo foil overlay.
 */
const HOLO_RARITIES = new Set(["Epic", "Legendary", "Mythical", "Fabled"]);

export default function CardArt({
  src,
  alt,
  rarity,
  className,
}: {
  src: string;
  alt: string;
  rarity?: string;
  className?: string;
}) {
  const holo = rarity ? HOLO_RARITIES.has(rarity) : false;
  return (
    <span className={`card-art${holo ? " holo" : ""}${className ? ` ${className}` : ""}`}>
      {src ? <img src={src} alt={alt} loading="lazy" draggable={false} /> : null}
    </span>
  );
}
