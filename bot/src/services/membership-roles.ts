/**
 * Membership role sync (spec 6.19): active members hold a special
 * role in the bot's main guild; expired members lose it. The diff is
 * a pure function so the sync policy is fully testable — the shard
 * only applies the result through discord.js.
 */
export interface RoleDiff {
  grant: string[];
  revoke: string[];
}

export function computeRoleDiff(activeUserIds: Set<string>, currentHolderIds: Set<string>): RoleDiff {
  const grant: string[] = [];
  const revoke: string[] = [];
  for (const id of activeUserIds) {
    if (!currentHolderIds.has(id)) grant.push(id);
  }
  for (const id of currentHolderIds) {
    if (!activeUserIds.has(id)) revoke.push(id);
  }
  return { grant, revoke };
}
