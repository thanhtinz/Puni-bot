/**
 * Discord enforcement adapter. Commands talk to this interface; the
 * client binds the real discord.js implementation after login
 * (LateBindingEnforcer), tests bind a fake. An enforcement that the
 * backend has not been bound for throws — commands treat that as a
 * failed action and close their case (see commands/moderation.ts).
 */

export interface Enforcer {
  timeout(guildId: string, userId: string, durationSec: number, reason: string): Promise<void>;
  removeTimeout(guildId: string, userId: string, reason: string): Promise<void>;
  kick(guildId: string, userId: string, reason: string): Promise<void>;
  ban(guildId: string, userId: string, reason: string): Promise<void>;
  unban(guildId: string, userId: string, reason: string): Promise<void>;
}

export class LateBindingEnforcer implements Enforcer {
  private backend: Enforcer | null = null;

  bind(backend: Enforcer): void {
    this.backend = backend;
  }

  private require(): Enforcer {
    if (!this.backend) throw new Error("Enforcer backend is not bound yet");
    return this.backend;
  }

  timeout(g: string, u: string, d: number, r: string) {
    return this.require().timeout(g, u, d, r);
  }
  removeTimeout(g: string, u: string, r: string) {
    return this.require().removeTimeout(g, u, r);
  }
  kick(g: string, u: string, r: string) {
    return this.require().kick(g, u, r);
  }
  ban(g: string, u: string, r: string) {
    return this.require().ban(g, u, r);
  }
  unban(g: string, u: string, r: string) {
    return this.require().unban(g, u, r);
  }
}

/** Discord's maximum timeout: 28 days. */
export const MAX_TIMEOUT_SEC = 28 * 24 * 3600;

/** Parse durations like "30s", "10m", "2h", "1d". Null when invalid. */
export function parseDuration(raw: string): number | null {
  const m = /^(\d+)(s|m|h|d)$/i.exec(raw.trim());
  if (!m) return null;
  const n = Number.parseInt(m[1], 10);
  if (!Number.isFinite(n) || n <= 0) return null;
  const mult = { s: 1, m: 60, h: 3600, d: 86400 }[m[2].toLowerCase() as "s" | "m" | "h" | "d"];
  return n * mult;
}

export function formatDuration(totalSec: number): string {
  if (totalSec % 86400 === 0) return `${totalSec / 86400} ngày`;
  if (totalSec % 3600 === 0) return `${totalSec / 3600} giờ`;
  if (totalSec % 60 === 0) return `${totalSec / 60} phút`;
  return `${totalSec} giây`;
}
