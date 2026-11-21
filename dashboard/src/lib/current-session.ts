import { cookies } from "next/headers";
import {
  ADMIN_COOKIE,
  SESSION_COOKIE,
  isOwner,
  verifyAdminToken,
  verifySessionToken,
  type Session,
} from "./session";

export async function currentSession(): Promise<Session | null> {
  const store = await cookies();
  return verifySessionToken(store.get(SESSION_COOKIE)?.value);
}

/** Owner + second factor verified (or second factor not configured —
 *  the admin layout shows a warning in that case). */
export async function adminGate(): Promise<
  | { ok: true; session: Session; secondFactorConfigured: boolean }
  | { ok: false; reason: "no-session" | "not-owner" | "need-verify"; session: Session | null }
> {
  const session = await currentSession();
  if (!session) return { ok: false, reason: "no-session", session: null };
  if (!isOwner(session)) return { ok: false, reason: "not-owner", session };
  const secondFactorConfigured = Boolean(
    process.env.ADMIN_PANEL_PASSWORD_SHA256 || process.env.OWNER_TOTP_SECRET,
  );
  if (!secondFactorConfigured) return { ok: true, session, secondFactorConfigured };
  const store = await cookies();
  const verified = verifyAdminToken(store.get(ADMIN_COOKIE)?.value, session.userId);
  if (!verified) return { ok: false, reason: "need-verify", session };
  return { ok: true, session, secondFactorConfigured };
}
