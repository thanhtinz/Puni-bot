/**
 * Discord OAuth2 helpers (login for dashboard + admin panel).
 * Scopes: identify + guilds — enough to know who the user is and
 * which guilds they can manage. No bot token is involved here.
 */
import type { SessionGuild } from "./session";

const API = "https://discord.com/api/v10";

export function discordClientId(): string {
  return process.env.DISCORD_CLIENT_ID || "";
}

export function discordRedirectUri(): string {
  return process.env.DISCORD_REDIRECT_URI || "http://localhost:3100/api/auth/callback";
}

export function authorizeUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: discordClientId(),
    redirect_uri: discordRedirectUri(),
    response_type: "code",
    scope: "identify guilds",
    state,
  });
  return `https://discord.com/oauth2/authorize?${params.toString()}`;
}

export interface DiscordUser {
  id: string;
  username: string;
  avatar: string | null;
}

export async function exchangeCode(code: string): Promise<{ user: DiscordUser; guilds: SessionGuild[] }> {
  const clientId = discordClientId();
  const clientSecret = process.env.DISCORD_CLIENT_SECRET || "";
  if (!clientId || !clientSecret) throw new Error("Discord OAuth chưa cấu hình (DISCORD_CLIENT_ID/SECRET).");
  const tokenRes = await fetch(`${API}/oauth2/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "authorization_code",
      code,
      redirect_uri: discordRedirectUri(),
    }),
  });
  if (!tokenRes.ok) throw new Error(`Discord token exchange failed: ${tokenRes.status}`);
  const token = (await tokenRes.json()) as { access_token: string };
  const headers = { Authorization: `Bearer ${token.access_token}` };
  const [userRes, guildsRes] = await Promise.all([
    fetch(`${API}/users/@me`, { headers }),
    fetch(`${API}/users/@me/guilds`, { headers }),
  ]);
  if (!userRes.ok) throw new Error(`Discord user fetch failed: ${userRes.status}`);
  const user = (await userRes.json()) as DiscordUser;
  const guildsRaw = guildsRes.ok ? ((await guildsRes.json()) as any[]) : [];
  const guilds: SessionGuild[] = guildsRaw.map((g) => ({
    id: String(g.id),
    name: String(g.name ?? ""),
    permissions: String(g.permissions ?? "0"),
  }));
  return { user, guilds };
}

export function avatarUrl(user: { id: string; avatar: string | null }): string | null {
  if (!user.avatar) return null;
  return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.png?size=64`;
}
