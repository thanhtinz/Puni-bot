import { redirect } from "next/navigation";

/** Membership buying lives inside the player area now (owner ruling
 *  2026-11-21) — the public site no longer hosts the purchase page. */
export default function MembershipMovedPage() {
  redirect("/me/membership");
}
