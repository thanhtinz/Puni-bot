/**
 * Cat paw print — one big pad + four toe beans, drawn as SVG.
 * Puni is a cat bot, so paw prints decorate the landing: scattered
 * around the hero, a walking trail, and accents on the CTA banner.
 */
export default function PawPrint({
  size = 34,
  color = "currentColor",
  opacity = 1,
  rotate = 0,
  style,
  className,
}: {
  size?: number;
  color?: string;
  opacity?: number;
  rotate?: number;
  style?: React.CSSProperties;
  className?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill={color}
      opacity={opacity}
      aria-hidden="true"
      className={className}
      style={{ transform: `rotate(${rotate}deg)`, display: "block", ...style }}
    >
      <ellipse cx="50" cy="76" rx="23" ry="17" />
      <ellipse cx="20" cy="50" rx="8.5" ry="12" transform="rotate(-18 20 50)" />
      <ellipse cx="39" cy="37" rx="9" ry="13" transform="rotate(-6 39 37)" />
      <ellipse cx="61" cy="37" rx="9" ry="13" transform="rotate(6 61 37)" />
      <ellipse cx="80" cy="50" rx="8.5" ry="12" transform="rotate(18 80 50)" />
    </svg>
  );
}
