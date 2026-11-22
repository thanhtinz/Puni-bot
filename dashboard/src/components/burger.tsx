"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

/**
 * Burger menu, BNT Shop pattern (owner request 2026-11-21): on
 * desktop the wrapped navigation renders inline exactly as before;
 * on mobile (<=900px) it collapses behind a hamburger button that
 * opens a LEFT SLIDE-IN DRAWER — backdrop dims the page, the drawer
 * head shows only the centered logo, no close button (tapping the
 * backdrop or picking an item closes it; route changes close it too).
 */
export function Burger({
  children,
  footer,
  tone = "dark",
  label = "Mở menu",
}: {
  children: ReactNode;
  footer?: ReactNode;
  tone?: "dark" | "light";
  label?: string;
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [path]);
  return (
    <>
      <div className="burger-inline">
        {children}
        {footer}
      </div>
      <button
        type="button"
        className="burger-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open
        ? createPortal(
            <>
              <div className="drawer-backdrop" onClick={() => setOpen(false)} />
              <div className={`drawer ${tone}`} role="dialog" aria-modal="true" aria-label={label}>
                <div className="drawer-head">
                  <img src="/api/assets/logo" alt="Puni" />
                </div>
                <div
                  className="drawer-body"
                  onClick={(e) => {
                    if ((e.target as HTMLElement).closest("a")) setOpen(false);
                  }}
                >
                  {children}
                </div>
                {footer ? <div className="drawer-foot">{footer}</div> : null}
              </div>
            </>,
            document.body,
          )
        : null}
    </>
  );
}
