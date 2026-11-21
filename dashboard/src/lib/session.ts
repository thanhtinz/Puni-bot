/**
 * Signed session cookie for the dashboard (spec 5).
 * Payload is JSON, integrity-protected with HMAC-SHA256 keyed by
 * SESSION_SECRET. No server-side session store: the cookie is the
 * session, expiry is inside the signed payload and always verified.
 */
import { createHmac, timingSafeEqual } from "node:crypto";

export interface SessionGuild {
  id: string;
  name: string;
  /** Discord permission bitfield as a decimal string. */
  permissions: string;
}

export interface Session {
  userId: string;
  username: string;
  avatar: string | null;
  guilds: SessionGuild[];
  /** Unix seconds. */
  exp: number;
}

export const SESSION_COOKIE = "puni_session";
export const ADMIN_COOKIE = "puni_admin";
const SESSION_TTL_SEC = 7 * 24 * 3600;

function secret(): string {
  const s = process.env.SESSION_SECRET || "";
  if (s.length < 16) throw new Error("SESSION_SECRET chưa cấu hình (tối thiểu 16 ký tự).");
  return s;
}

function sign(data: string): string {
  return createHmac("sha256", secret()).update(data).digest("base64url");
}

export function createSessionToken(input: {
  userId: string;
  username: string;
  avatar: string | null;
  guilds: SessionGuild[];
  nowSec?: number;
}): string {
  const now = input.nowSec ?? Math.floor(Date.now() / 1000);
  const payload: Session = {
    userId: input.userId,
    username: input.username,
    avatar: input.avatar,
    guilds: input.guilds,
    exp: now + SESSION_TTL_SEC,
  };
  const body = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifySessionToken(token: string | undefined | null, nowSec?: number): Session | null {
  if (!token) return null;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return null;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  let payload: Session;
  try {
    payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as Session;
  } catch {
    return null;
  }
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  if (!payload.exp || payload.exp < now) return null;
  if (typeof payload.userId !== "string" || !payload.userId) return null;
  return payload;
}

/** Second-factor proof for the owner admin panel: a short-lived
 *  signed token issued only after password/TOTP verification. */
export function createAdminToken(userId: string, nowSec?: number): string {
  const now = nowSec ?? Math.floor(Date.now() / 1000);
  const body = Buffer.from(JSON.stringify({ userId, exp: now + 12 * 3600, admin: true }), "utf8").toString("base64url");
  return `${body}.${sign(body)}`;
}

export function verifyAdminToken(token: string | undefined | null, userId: string, nowSec?: number): boolean {
  if (!token) return false;
  const dot = token.lastIndexOf(".");
  if (dot <= 0) return false;
  const body = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const expected = sign(body);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString("utf8")) as {
      userId?: string;
      exp?: number;
      admin?: boolean;
    };
    const now = nowSec ?? Math.floor(Date.now() / 1000);
    return payload.admin === true && payload.userId === userId && !!payload.exp && payload.exp >= now;
  } catch {
    return false;
  }
}

const ADMINISTRATOR = 0x8n;
const MANAGE_GUILD = 0x20n;

/** Can this session manage the guild (owner of the guild always can:
 *  Discord reports owner guilds with full permissions in OAuth). */
export function canManageGuild(session: Session, guildId: string): boolean {
  const g = session.guilds.find((x) => x.id === guildId);
  if (!g) return false;
  let perms: bigint;
  try {
    perms = BigInt(g.permissions);
  } catch {
    return false;
  }
  return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
}

export function manageableGuilds(session: Session): SessionGuild[] {
  return session.guilds.filter((g) => {
    try {
      const perms = BigInt(g.permissions);
      return (perms & ADMINISTRATOR) !== 0n || (perms & MANAGE_GUILD) !== 0n;
    } catch {
      return false;
    }
  });
}

export function ownerDiscordId(): string {
  return process.env.OWNER_DISCORD_ID || "847746890808164383";
}

export function isOwner(session: Session | null): boolean {
  return !!session && session.userId === ownerDiscordId();
}
