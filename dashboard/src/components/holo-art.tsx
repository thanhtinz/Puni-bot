"use client";

import { useEffect, useState } from "react";
import { artSrc } from "@/components/card-art";

/**
 * Impact burst VFX: an 8-ray star flash in the effect colour,
 * played once per hit (remounted by key). Shared by every arena.
 */
export function VfxBurst({ color, burstKey }: { color?: string; burstKey: number }) {
  const rays: Array<[number, number, number, number]> = [
    [64, 50, 96, 50], [59.9, 59.9, 82.5, 82.5], [50, 64, 50, 96], [40.1, 59.9, 17.5, 82.5],
    [36, 50, 4, 50], [40.1, 40.1, 17.5, 17.5], [50, 36, 50, 4], [59.9, 40.1, 82.5, 17.5],
  ];
  return (
    <svg key={burstKey} className="vfx-burst" viewBox="0 0 100 100" style={{ color: color ?? "#fbbf24" }} aria-hidden>
      {rays.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="currentColor" strokeWidth={5} strokeLinecap="round" />
      ))}
      <circle cx={50} cy={50} r={9} fill="currentColor" />
    </svg>
  );
}

/**
 * Full-body hologram projection of a card's artwork (spec 6.39):
 * the art stands large over a cone of light above its field slot,
 * tinted and flickering like a 3D projection — the way Yu-Gi-Oh's
 * Solid Vision works. It materialises when the card enters the
 * field, lunges when it attacks, bursts with an element-coloured
 * impact flash when hit, fades when destroyed and dims when
 * rested. Sizes: "lg" square art (Yu-Gi-Oh monsters), "portrait"
 * character crop (One Piece characters), "leader" (One Piece
 * leaders), "sm" compact. variant "art" shows the image as-is
 * (YGO art-only images), variant "crop" zooms into the character
 * artwork at the top of a full card (One Piece).
 */
export default function HoloArt({
  src,
  side,
  attacking,
  hit,
  dying,
  dimmed,
  variant,
  size = "sm",
  vfxColor,
  hitKey,
}: {
  src: string;
  side: "a" | "b";
  attacking?: boolean;
  hit?: boolean;
  dying?: boolean;
  dimmed?: boolean;
  variant: "art" | "crop";
  size?: "sm" | "lg" | "portrait" | "leader";
  vfxColor?: string;
  hitKey?: number;
}) {
  // One retry with a cache-busting query: a single cold-proxy
  // failure must not kill the projection for the whole battle.
  const [tries, setTries] = useState(0);
  useEffect(() => {
    setTries(0);
  }, [src]);
  if (!src || tries > 1) return <div className={`holo-wrap holo-${size} is-empty`} aria-hidden />;
  const baseSrc = artSrc(src);
  const imgSrc = tries === 0 ? baseSrc : `${baseSrc}${baseSrc.includes("?") ? "&" : "?"}retry=1`;
  return (
    <div
      className={`holo-wrap holo-${size}${attacking ? " is-attacking" : ""}${hit ? " is-hit" : ""}${dying ? " is-dying" : ""}${dimmed ? " is-dim" : ""}`}
      data-side={side}
      aria-hidden
    >
      <div className="holo-cone" />
      <span className={`holo-art-frame ${variant === "crop" ? "is-crop" : "is-art"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={imgSrc} alt="" onError={() => setTries((t) => t + 1)} />
      </span>
      {hit && hitKey !== undefined ? <VfxBurst color={vfxColor} burstKey={hitKey} /> : null}
      <div className="holo-ring" />
    </div>
  );
}
