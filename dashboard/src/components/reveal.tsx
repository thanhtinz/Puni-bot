"use client";

/** Scroll-reveal wrapper: children start slightly lowered and
 *  transparent, then pop in with a soft overshoot easing when they
 *  enter the viewport. Respects prefers-reduced-motion via CSS. */
import { useEffect, useRef, type ReactNode } from "react";

export default function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            el.classList.add("in");
            io.disconnect();
          }
        }
      },
      { threshold: 0.12 },
    );
    io.observe(el);
    // Safety net: never leave content hidden if the observer
    // somehow never fires (odd webviews, screenshot tooling).
    const fallback = setTimeout(() => el.classList.add("in"), 2600);
    return () => {
      io.disconnect();
      clearTimeout(fallback);
    };
  }, []);
  return (
    <div ref={ref} className={`reveal ${className ?? ""}`} style={{ transitionDelay: `${delay}ms` }}>
      {children}
    </div>
  );
}
