import { redirect } from "next/navigation";

/** The card market lives inside the player area now (owner ruling
 *  2026-11-21) — the public site no longer hosts TCG pages. */
export default function TcgMovedPage() {
  redirect("/me/market");
}
