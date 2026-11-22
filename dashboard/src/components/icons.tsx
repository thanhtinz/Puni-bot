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

export function IconList({ size = 19, style }: IconProps) {
  return (
    <svg {...base(size)} style={style}>
      <path d="M9 6h11M9 12h11M9 18h11" />
      <path d="M4 6h.01M4 12h.01M4 18h.01" strokeWidth={3} />
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
