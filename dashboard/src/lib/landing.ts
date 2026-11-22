/**
 * Post-login routing helpers (spec 6.24): a user "manages Puni"
 * somewhere when they hold admin/manage rights in at least one guild
 * that has a guild_settings row (Puni present + configured there).
 */
import { listConfiguredGuildIds } from "./db";
import { manageableGuilds, type Session } from "./session";

export async function canManagePuni(session: Session): Promise<boolean> {
  const manageable = manageableGuilds(session);
  if (!manageable.length) return false;
  const configured = new Set(await listConfiguredGuildIds().catch(() => [] as string[]));
  return manageable.some((g) => configured.has(g.id));
}
