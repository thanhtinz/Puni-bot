/**
 * Graded-slab presentation for high-value pulls (spec 6.29):
 * the card sits inside a clear plastic grading case with a label
 * strip on top — card name, set line, grade and the instance code
 * as the certificate number, like a real graded collectible.
 * Pure presentation; used for Legendary+ reveals.
 */
export default function SlabCard({
  imageUrl,
  name,
  setLine,
  grade,
  cert,
  variant,
}: {
  imageUrl: string;
  name: string;
  setLine: string;
  grade: string;
  cert: string;
  /** "shop" = clear-plastic case for shop grids/details (spec 6.36). */
  variant?: "shop";
}) {
  return (
    <div className={`slab${variant === "shop" ? " shop-slab" : ""}`} role="img" aria-label={`${name}, ${grade}`}>
      <div className="slab-label">
        <div className="slab-label-main">
          <strong>{name}</strong>
          <span>{setLine}</span>
        </div>
        <div className="slab-label-grade">
          <strong>{grade}</strong>
          <span>PUNI · {cert}</span>
        </div>
      </div>
      <div className="slab-window">
        <img src={imageUrl} alt={name} draggable={false} />
      </div>
      <div className="slab-shine" aria-hidden="true" />
    </div>
  );
}

export function gradeForRarity(rarity: string): string | null {
  switch (rarity) {
    case "Fabled":
      return "GEM MT 10";
    case "Mythical":
      return "MINT 9";
    case "Legendary":
      return "NM-MT 8";
    case "Epic":
      return "NM 7";
    default:
      return null;
  }
}
