"use client";

/**
 * 3D tilt wrapper for shop cards (spec 6.36): the card leans toward
 * the cursor and a light spot follows it; Epic+ cards also carry the
 * animated holo sheen. Pure presentation — transform is driven by
 * CSS variables so the reset transition stays smooth, and
 * prefers-reduced-motion disables the effect in CSS.
 */
import { useRef, type MouseEvent, type ReactNode } from "react";

export default function TiltCard({
  children,
  holo = false,
  className,
}: {
  children: ReactNode;
  holo?: boolean;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const onMove = (e: MouseEvent) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return;
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--ry", `${((px - 0.5) * 14).toFixed(2)}deg`);
    el.style.setProperty("--rx", `${((0.5 - py) * 12).toFixed(2)}deg`);
    el.style.setProperty("--mx", `${(px * 100).toFixed(1)}%`);
    el.style.setProperty("--my", `${(py * 100).toFixed(1)}%`);
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    el.style.setProperty("--rx", "0deg");
    el.style.setProperty("--ry", "0deg");
  };

  return (
    <div
      ref={ref}
      className={`tilt${holo ? " tilt-holo" : ""}${className ? ` ${className}` : ""}`}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
    >
      {children}
      <span className="tilt-shine" aria-hidden="true" />
      {holo ? <span className="tilt-sheen" aria-hidden="true" /> : null}
    </div>
  );
}
