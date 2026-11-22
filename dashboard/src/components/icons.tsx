/**
 * Shared icon set — inline SVG, stroke style, colored purely by CSS
 * (`currentColor`). No emoji, no icon font, no external assets.
 * Usage: <IconHome size={19} /> — color comes from the parent's CSS color.
 */
import type { CSSProperties } from "react";

interface IconProps {
  size?: number;
  style?: CSSProperties;
}

function base(size: number) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    "aria-hidden": true,
    focusable: false,
  };
}

export function IconHome({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M3 10.5 12 3l9 7.5" />
      <path d="M5 9.5V21h14V9.5" />
      <path d="M9.5 21v-6h5v6" />
    </svg>
  );
}

export function IconChart({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M4 20V10" />
      <path d="M10 20V4" />
      <path d="M16 20v-7" />
      <path d="M22 20H2" />
    </svg>
  );
}

export function IconCoins({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <circle cx="9" cy="9" r="6" />
      <path d="M14.5 5.6a6 6 0 1 1-8.9 8.9" />
      <path d="M9 6.5v5" />
      <path d="M7.2 8.2c.5-.5 1.1-.7 1.8-.7 1 0 1.8.6 1.8 1.4 0 2-3.6 1.2-3.6 3 0 .8.8 1.4 1.8 1.4.7 0 1.3-.2 1.8-.7" />
    </svg>
  );
}

export function IconServer({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <rect x="3" y="4" width="18" height="7" rx="2" />
      <rect x="3" y="13" width="18" height="7" rx="2" />
      <path d="M7 7.5h.01M7 16.5h.01" strokeWidth={3} />
    </svg>
  );
}

export function IconChat({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M21 11.5a8.5 8.5 0 0 1-8.5 8.5c-1.5 0-3-.4-4.2-1.1L3 20l1.1-5.3A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M8.5 10.5h7M8.5 13.5h4" />
    </svg>
  );
}

export function IconGrid({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <rect x="3" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5" />
      <rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5" />
      <rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" />
    </svg>
  );
}

export function IconGlobe({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18" />
      <path d="M12 3a14.5 14.5 0 0 1 0 18M12 3a14.5 14.5 0 0 0 0 18" />
    </svg>
  );
}

export function IconClock({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3.5 2" />
    </svg>
  );
}

export function IconTrophy({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M8 21h8M12 17v4" />
      <path d="M7 4h10v5a5 5 0 0 1-10 0V4Z" />
      <path d="M7 5.5H4.5a.5.5 0 0 0-.5.5c0 2 1.3 3.5 3 3.5M17 5.5h2.5a.5.5 0 0 1 .5.5c0 2-1.3 3.5-3 3.5" />
    </svg>
  );
}

export function IconList({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth={3} />
    </svg>
  );
}

export function IconQuest({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m8.5 12.2 2.4 2.4 4.6-5" />
    </svg>
  );
}

export function IconSearch({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <circle cx="11" cy="11" r="7" />
      <path d="m20.5 20.5-4.6-4.6" />
    </svg>
  );
}

export function IconEmbed({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <path d="M7.5 4v16" strokeWidth={3} />
      <path d="M12 9h5M12 13h5" />
    </svg>
  );
}

export function IconCards({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <rect x="8" y="5" width="12" height="16" rx="2" transform="rotate(8 14 13)" />
      <rect x="3.5" y="4" width="12" height="16" rx="2" fill="var(--card, #fff)" />
      <path d="M6.5 9h6M6.5 12.5h6" />
    </svg>
  );
}

export function IconSpark({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M12 3l1.9 5.6L19.5 10l-5.6 1.9L12 17.5l-1.9-5.6L4.5 10l5.6-1.4L12 3Z" />
      <path d="M19 16.5l.8 2.2 2.2.8-2.2.8-.8 2.2-.8-2.2-2.2-.8 2.2-.8.8-2.2Z" />
    </svg>
  );
}

export function IconHeart({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M12 20.5S4 15.4 4 9.9C4 7 6.2 4.9 8.8 4.9c1.4 0 2.6.7 3.2 1.7.6-1 1.8-1.7 3.2-1.7 2.6 0 4.8 2.1 4.8 5 0 5.5-8 10.6-8 10.6Z" />
    </svg>
  );
}

export function IconShield({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M12 3l7.5 3v5.5c0 4.6-3.2 7.9-7.5 9.5-4.3-1.6-7.5-4.9-7.5-9.5V6L12 3Z" />
      <path d="M9 11.8l2.2 2.2 4-4.2" />
    </svg>
  );
}

export function IconActivity({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M3 12h4l2.5-6 4 12L16 12h5" />
    </svg>
  );
}

export function IconUsers({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <circle cx="9" cy="8.5" r="3.5" />
      <path d="M3 20c.6-3.2 3-5 6-5s5.4 1.8 6 5" />
      <path d="M16 5.4a3.5 3.5 0 0 1 0 6.2M18.5 15.4c1.4.8 2.3 2.3 2.6 4.6" />
    </svg>
  );
}

export function IconFrame({ size = 19, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" style={style} aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="2.5" />
      <circle cx="9" cy="10" r="1.6" />
      <path d="m5 19 5.2-5.2a1.6 1.6 0 0 1 2.3 0L17 18.3" />
      <path d="m13.5 15.5 1.7-1.7a1.6 1.6 0 0 1 2.3 0L21 17.3" />
    </svg>
  );
}

export function IconWallet({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M3 7a2.5 2.5 0 0 1 2.5-2.5h12A2.5 2.5 0 0 1 20 7v10a2.5 2.5 0 0 1-2.5 2.5h-12A2.5 2.5 0 0 1 3 17V7Z" />
      <path d="M3 7.5h17" />
      <path d="M16 14.5h.01" strokeWidth={3.2} />
    </svg>
  );
}

export function IconLogout({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M14 4H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h7" />
      <path d="M10 12h11M18 8.5 21.5 12 18 15.5" />
    </svg>
  );
}

export function IconPaw({ size = 19 }: IconProps) {
  return (
    <svg {...base(size)} fill="currentColor" stroke="none" aria-hidden="true">
      <ellipse cx="12" cy="15.5" rx="4.4" ry="3.6" />
      <circle cx="4.6" cy="10.6" r="1.9" />
      <circle cx="8.2" cy="6.9" r="2" />
      <circle cx="12.6" cy="5.9" r="2" />
      <circle cx="16.9" cy="7.6" r="1.9" />
      <circle cx="19.6" cy="11.4" r="1.7" />
    </svg>
  );
}

export function IconBag({ size = 19 }: IconProps) {
  return (
    <svg {...base(size)} aria-hidden="true">
      <path d="M5 8h14l-1.2 12.2a1.8 1.8 0 0 1-1.8 1.6H8a1.8 1.8 0 0 1-1.8-1.6L5 8Z" />
      <path d="M8.5 10V6.5a3.5 3.5 0 0 1 7 0V10" />
    </svg>
  );
}

/** Discord brand glyph (fill, from Simple Icons — CC0). */
export function IconDiscord({ size = 18, style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden style={style}>
      <path d="M20.317 4.3698a19.7913 19.7913 0 00-4.8851-1.5152.0741.0741 0 00-.0785.0371c-.211.3753-.4447.8648-.6083 1.2495-1.8447-.2762-3.68-.2762-5.4868 0-.1636-.3933-.4058-.8742-.6177-1.2495a.077.077 0 00-.0785-.037 19.7363 19.7363 0 00-4.8852 1.515.0699.0699 0 00-.0321.0277C.5334 9.0458-.319 13.5799.0992 18.0578a.0824.0824 0 00.0312.0561c2.0528 1.5076 4.0413 2.4228 5.9929 3.0294a.0777.0777 0 00.0842-.0276c.4616-.6304.8731-1.2952 1.226-1.9942a.076.076 0 00-.0416-.1057c-.6528-.2476-1.2743-.5495-1.8722-.8923a.077.077 0 01-.0076-.1277c.1258-.0943.2517-.1923.3718-.2914a.0743.0743 0 01.0776-.0105c3.9278 1.7933 8.18 1.7933 12.0614 0a.0739.0739 0 01.0785.0095c.1202.099.246.1981.3728.2924a.077.077 0 01-.0066.1276 12.2986 12.2986 0 01-1.873.8914.0766.0766 0 00-.0407.1067c.3604.698.7719 1.3628 1.225 1.9932a.076.076 0 00.0842.0286c1.961-.6067 3.9495-1.5219 6.0023-3.0294a.077.077 0 00.0313-.0552c.5004-5.177-.8382-9.6739-3.5485-13.6604a.061.061 0 00-.0312-.0286zM8.02 15.3312c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9555-2.4189 2.157-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.9555 2.4189-2.1569 2.4189zm7.9748 0c-1.1825 0-2.1569-1.0857-2.1569-2.419 0-1.3332.9554-2.4189 2.1569-2.4189 1.2108 0 2.1757 1.0952 2.1568 2.419 0 1.3332-.946 2.4189-2.1568 2.4189Z" />
    </svg>
  );
}

export function IconLogin({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
      <polyline points="10 17 15 12 10 7" />
      <line x1="15" x2="3" y1="12" y2="12" />
    </svg>
  );
}
