"use client";

import { useState, type ReactNode } from "react";

/**
 * Burger menu (owner request 2026-11-21): on desktop the wrapper is
 * display:contents so the wrapped navigation lays out exactly as
 * before; on mobile (<=900px) it collapses behind a hamburger button
 * that toggles the panel. Used by every surface's main navigation:
 * public nav, TCG tabs, player tabs, dashboard + admin sidebars.
 */
export function Burger({ children, label = "Mở menu" }: { children: ReactNode; label?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={`burger${open ? " open" : ""}`}>
      <button
        type="button"
        className="burger-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span />
        <span />
        <span />
      </button>
      <div className="burger-panel">{children}</div>
    </div>
  );
}
