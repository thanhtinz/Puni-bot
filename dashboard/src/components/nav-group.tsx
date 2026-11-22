"use client";

import { useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";

/**
 * Collapsible group inside the burger drawer (owner request
 * 2026-11-22: every TCG entry lives under one "TCG" dropdown).
 * Starts open when the current route is one of the group's paths so
 * the player always sees where they are; the header button toggles
 * it. The button is a <button>, so the drawer's close-on-pick (which
 * only reacts to <a> clicks) never fires for a toggle.
 */
export function NavGroup({
  icon,
  label,
  paths,
  children,
}: {
  icon: ReactNode;
  label: string;
  paths: string[];
  children: ReactNode;
}) {
  const path = usePathname() ?? "";
  const inGroup = paths.some((p) => path === p || path.startsWith(`${p}/`));
  const [open, setOpen] = useState(inGroup);
  const [wasInGroup, setWasInGroup] = useState(inGroup);
  if (inGroup !== wasInGroup) {
    setWasInGroup(inGroup);
    if (inGroup) setOpen(true);
  }
  return (
    <div className="nav-group">
      <button
        type="button"
        className="player-tab nav-group-head"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {icon}
        {label}
        <svg
          className={`nav-group-chev${open ? " open" : ""}`}
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open ? <div className="nav-group-items">{children}</div> : null}
    </div>
  );
}
