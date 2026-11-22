"use client";

import { useEffect, useState } from "react";
import { artSrc } from "@/components/card-art";

/**
 * Hologram projection of a card's artwork (spec 6.39): the art
 * hovers over a cone of light above its field slot, tinted and
 * flickering like a 3D projection — the way Yu-Gi-Oh's Solid Vision
 * and One Piece holograms work. It lunges when the card attacks,
 * flashes when hit and fades when destroyed. Yu-Gi-Oh has no
 * animated sprite library, so its monsters project their art-only
 * image (YGOPRODeck cropped art); One Piece projects a crop of the
 * card's character art. variant "art" shows the image as-is,
 * variant "crop" zooms into the artwork area of a full card.
 */
export default function HoloArt({
  src,
  side,
  attacking,
  hit,
  dying,
  dimmed,
  variant,
}: {
  src: string;
  side: "a" | "b";
  attacking?: boolean;
  hit?: boolean;
  dying?: boolean;
  dimmed?: boolean;
  variant: "art" | "crop";
}) {
  const [err, setErr] = useState(false);
  useEffect(() => {
    setErr(false);
  }, [src]);
  if (!src || err) return <div className="holo-wrap holo-sm is-empty" aria-hidden />;
  return (
    <div
      className={`holo-wrap holo-sm${attacking ? " is-attacking" : ""}${hit ? " is-hit" : ""}${dying ? " is-dying" : ""}${dimmed ? " is-dim" : ""}`}
      data-side={side}
      aria-hidden
    >
      <div className="holo-cone" />
      <span className={`holo-art-frame ${variant === "crop" ? "is-crop" : "is-art"}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={artSrc(src)} alt="" onError={() => setErr(true)} />
      </span>
      <div className="holo-ring" />
    </div>
  );
}
