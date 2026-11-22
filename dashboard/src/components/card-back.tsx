/**
 * The Puni card back: deep-navy foil with a gold rim, a subtle
 * compass-rose pattern and the mascot in the middle. Used by the
 * pack-opening ceremony (face-down pulls) and the battle versus
 * stage (the enemy team before a fight). Pure CSS + the logo.
 */
export default function CardBack({ label }: { label?: string }) {
  return (
    <span className="puni-cardback" aria-hidden="true">
      <span className="puni-cardback-inner">
        <img src="/logo.jpg" alt="" className="puni-cardback-logo" draggable={false} />
        <span className="puni-cardback-word">PUNI</span>
        {label ? <span className="puni-cardback-label">{label}</span> : null}
      </span>
    </span>
  );
}
