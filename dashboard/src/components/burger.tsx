"use client";

import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

/**
 * Burger menu: on desktop the wrapped navigation renders inline
 * exactly as before; on mobile (<=900px) it collapses behind a
 * hamburger button. Two mobile variants:
 *  - "drawer" (default): LEFT SLIDE-IN DRAWER, BNT Shop pattern —
 *    backdrop dims the page, the drawer head shows only the centered
 *    logo, no close button (backdrop tap / item pick / route change
 *    closes it).
 *  - "dropdown": TOP-DOWN panel dropping from under the header
 *    (owner request 2026-11-22 for the public site / landing) — the
 *    button toggles it, tapping outside or picking an item closes it.
 */
export function Burger({
  children,
  footer,
  tone = "dark",
  label = "Mở menu",
  variant = "drawer",
}: {
  children: ReactNode;
  footer?: ReactNode;
  tone?: "dark" | "light";
  label?: string;
  variant?: "drawer" | "dropdown";
}) {
  const [open, setOpen] = useState(false);
  const path = usePathname();
  useEffect(() => {
    setOpen(false);
  }, [path]);
  const closeOnPick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("a")) setOpen(false);
  };
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
        onClick={() => (variant === "dropdown" ? setOpen((v) => !v) : setOpen(true))}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
          <path d="M4 7h16M4 12h16M4 17h16" />
        </svg>
      </button>
      {open && variant === "dropdown"
        ? createPortal(
            <>
              <div className="dropdown-backdrop" onClick={() => setOpen(false)} />
              <div className={`dropdown-panel ${tone}`} role="dialog" aria-modal="true" aria-label={label}>
                <div className="dropdown-body" onClick={closeOnPick}>
                  {children}
                </div>
                {footer ? <div className="dropdown-foot">{footer}</div> : null}
              </div>
            </>,
            document.body,
          )
        : null}
      {open && variant === "drawer"
        ? createPortal(
            <>
              <div className="drawer-backdrop" onClick={() => setOpen(false)} />
              <div className={`drawer ${tone}`} role="dialog" aria-modal="true" aria-label={label}>
                <div className="drawer-head">
                  <img src="/api/assets/logo" alt="Puni" />
                </div>
                <div className="drawer-body" onClick={closeOnPick}>
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
